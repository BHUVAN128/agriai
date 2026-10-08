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
