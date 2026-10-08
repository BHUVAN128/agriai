"""OR-Tools vehicle-routing engine for farm-to-market shipments."""

import json
import math
from pathlib import Path
from typing import Any

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "mock_nodes.json"


def load_network() -> dict[str, list[dict[str, Any]]]:
    with DATA_PATH.open(encoding="utf-8") as data_file:
        return json.load(data_file)


def all_nodes(network: dict[str, list[dict[str, Any]]] | None = None) -> dict[str, dict[str, Any]]:
    network = network or load_network()
    return {
        node["id"]: node
        for group in ("farms", "markets", "cold_storages", "waypoints", "buyers")
        for node in network.get(group, [])
    }


def distance_km(first: dict[str, Any], second: dict[str, Any]) -> float:
    """Calculate great-circle distance between two coordinate points."""
    earth_radius_km = 6371.0
    lat1, lat2 = math.radians(first["lat"]), math.radians(second["lat"])
    delta_lat = lat2 - lat1
    delta_lon = math.radians(second["lon"] - first["lon"])
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * earth_radius_km * math.asin(math.sqrt(haversine))


def solve_route(
    start_id: str,
    end_id: str,
    waypoint_ids: list[str] | None = None,
    produce_type: str = "Tomatoes",
    network: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Solve a single-vehicle VRPTW with fixed start/end and optional required stops."""
    nodes_by_id = all_nodes(network)
    route_ids = [start_id, *(waypoint_ids or []), end_id]
    missing = [node_id for node_id in route_ids if node_id not in nodes_by_id]
    if missing:
        raise ValueError(f"Unknown route node(s): {', '.join(missing)}")
    if len(route_ids) < 2:
        raise ValueError("A route requires a start and end node")

    route_nodes = [nodes_by_id[node_id] for node_id in route_ids]
    size = len(route_nodes)
    manager = pywrapcp.RoutingIndexManager(size, 1, [0], [size - 1])
    routing = pywrapcp.RoutingModel(manager)

    distances_meters = [
        [
            int(distance_km(origin, destination) * 1000)
            for destination in route_nodes
        ]
        for origin in route_nodes
    ]
    driving_minutes = [
        [max(1, int(round(distance / 1000 / 35 * 60))) for distance in row]
        for row in distances_meters
    ]
    perishability_weights = {"Tomatoes": 1.0, "Apples": 0.6, "Onions": 0.25}
    perishability_weight = perishability_weights.get(produce_type)
    if perishability_weight is None:
        raise ValueError(f"Unsupported produce type: {produce_type}")

    def perishable_cost_callback(from_index: int, to_index: int) -> int:
        origin = manager.IndexToNode(from_index)
        destination = manager.IndexToNode(to_index)
        distance_cost = distances_meters[origin][destination]
        time_cost = driving_minutes[origin][destination] * 100
        return distance_cost + int(time_cost * perishability_weight)

    def time_callback(from_index: int, to_index: int) -> int:
        origin = manager.IndexToNode(from_index)
        destination = manager.IndexToNode(to_index)
        return driving_minutes[origin][destination]

    cost_index = routing.RegisterTransitCallback(perishable_cost_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(cost_index)
    time_index = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(time_index, 30, 24 * 60, True, "Time")
    time_dimension = routing.GetDimensionOrDie("Time")

    for node_index, node in enumerate(route_nodes[1:-1], start=1):
        window = node.get("time_window_minutes", [0, 24 * 60])
        time_dimension.CumulVar(manager.NodeToIndex(node_index)).SetRange(
            int(window[0]), int(window[1])
        )

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.FromSeconds(1)
    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        raise ValueError("OR-Tools could not find a feasible route for these stops")

    ordered_nodes = []
    index = routing.Start(0)
    while not routing.IsEnd(index):
        node_index = manager.IndexToNode(index)
        ordered_nodes.append(route_nodes[node_index])
        index = solution.Value(routing.NextVar(index))
    ordered_nodes.append(route_nodes[manager.IndexToNode(index)])

    farms = {
        farm["id"] for farm in (network or load_network()).get("farms", [])
    }
    path = []
    total_distance_km = 0.0
    total_minutes = 0
    for position, node in enumerate(ordered_nodes):
        path.append({
            "id": node["id"],
            "name": node["name"],
            "lat": node["lat"],
            "lon": node["lon"],
            "type": node.get("type", "farm" if node["id"] in farms else "market"),
        })
        if position:
            total_distance_km += distance_km(ordered_nodes[position - 1], node)
            total_minutes += driving_minutes[
                route_nodes.index(ordered_nodes[position - 1])
            ][route_nodes.index(node)]

    return {
        "nodes": path,
        "distance_km": round(total_distance_km, 2),
        "eta_minutes": total_minutes,
        "eta_hours": round(total_minutes / 60, 2),
    }


def optimize_initial_route(
    farm_id: str,
    produce_type: str = "Tomatoes",
    capacity_kg: float = 1000.0,
    candidate_market_ids: list[str] | None = None,
    network: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Evaluate candidate destination markets with OR-Tools and spoilage penalty.
    
    Objective: minimize total travel time + spoilage penalty computed with
    exponential decay Q(t) = Q0 * e^(-k*t). Faster-spoiling produce gets
    higher penalty, auto-selecting the best optimal market node.
    """
    from agents.spoilage_agent import calculate_quality, DECAY_COEFFICIENTS

    net = network or load_network()
    all_markets = net.get("markets", [])
    if candidate_market_ids:
        markets_to_test = [m for m in all_markets if m["id"] in candidate_market_ids]
    else:
        markets_to_test = all_markets

    if not markets_to_test:
        raise ValueError("No candidate markets available for optimization")

    unit_values = {"Tomatoes": 1.8, "Apples": 2.4, "Onions": 1.1}
    unit_val = unit_values.get(produce_type, 1.5)
    cargo_value = capacity_kg * unit_val

    candidates = []
    best_candidate = None
    lowest_cost = float("inf")

    for market in markets_to_test:
        try:
            route = solve_route(
                farm_id,
                market["id"],
                produce_type=produce_type,
                network=net,
            )
            travel_hours = route["eta_minutes"] / 60.0
            arrival_quality = calculate_quality(produce_type, travel_hours, temperature_celsius=22.0)
            spoilage_penalty = round(cargo_value * (1.0 - arrival_quality / 100.0), 2)
            value_saved = round(cargo_value * (arrival_quality / 100.0), 2)

            # Combined objective cost: travel time penalty + spoilage loss penalty
            decay_k = DECAY_COEFFICIENTS.get(produce_type, 0.05)
            objective_cost = round((route["eta_minutes"] * 0.5) + (spoilage_penalty * (1.0 + decay_k * 10)), 2)

            cand_info = {
                "market_id": market["id"],
                "market_name": market["name"],
                "lat": market["lat"],
                "lon": market["lon"],
                "distance_km": route["distance_km"],
                "eta_minutes": route["eta_minutes"],
                "eta_hours": route["eta_hours"],
                "arrival_quality_percent": arrival_quality,
                "spoilage_penalty": spoilage_penalty,
                "value_saved": value_saved,
                "objective_cost": objective_cost,
                "route": route,
            }
            candidates.append(cand_info)

            if objective_cost < lowest_cost:
                lowest_cost = objective_cost
                best_candidate = cand_info
        except Exception:
            continue

    if not candidates or not best_candidate:
        raise ValueError("Failed to solve route for any candidate markets")

    # Sort candidates by objective cost ascending
    candidates.sort(key=lambda c: c["objective_cost"])
    for idx, c in enumerate(candidates):
        c["rank"] = idx + 1
        c["is_best"] = (c["market_id"] == best_candidate["market_id"])

    rec_reason = (
        f"Optimal destination '{best_candidate['market_name']}' delivers "
        f"{best_candidate['arrival_quality_percent']}% freshness with lowest spoilage penalty "
        f"(${best_candidate['spoilage_penalty']:.2f}) over {best_candidate['distance_km']} km."
    )

    return {
        "best_market_id": best_candidate["market_id"],
        "best_market_name": best_candidate["market_name"],
        "best_route": best_candidate["route"],
        "arrival_quality_percent": best_candidate["arrival_quality_percent"],
        "value_saved": best_candidate["value_saved"],
        "cargo_value": round(cargo_value, 2),
        "recommendation_reason": rec_reason,
        "candidates": candidates,
    }


def reroute_from_position(
    current_lat: float,
    current_lon: float,
    current_name: str,
    destination_id: str,
    produce_type: str = "Tomatoes",
    network: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Reroute dynamically from truck's current position to destination or recovery facility."""
    net = network or load_network()
    temp_node_id = "CURRENT_TRUCK_POS"
    virtual_node = {
        "id": temp_node_id,
        "name": f"Current Location ({current_name})",
        "lat": current_lat,
        "lon": current_lon,
        "type": "checkpoint",
    }
    net_copy = {k: list(v) for k, v in net.items()}
    net_copy.setdefault("waypoints", []).append(virtual_node)

    return solve_route(
        temp_node_id,
        destination_id,
        produce_type=produce_type,
        network=net_copy,
    )

