"""Shipment-quality supervisor and recovery destination selection."""

from typing import Any

from .route_agent import all_nodes, distance_km, load_network


def evaluate_incident(
    quality_percent: float,
    incident_node: dict[str, Any],
    network: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Choose a recovery tier and nearest suitable market or cold store."""
    network = network or load_network()
    nodes = all_nodes(network)

    if quality_percent <= 50:
        tier = 3
        action = "flash_sale"
        destination = None
        reason = "Quality is at or below 50%; activate a local flash sale."
    elif quality_percent <= 75:
        tier = 2
        action = "cold_storage"
        candidates = network.get("cold_storages", [])
        destination = min(candidates, key=lambda item: distance_km(incident_node, item))
        reason = "Quality is between 50% and 75%; divert to the nearest cold store."
    else:
        tier = 1
        action = "secondary_market"
        candidates = [
            market for market in network.get("markets", [])
            if market.get("id") != incident_node.get("id")
        ]
        destination = min(candidates, key=lambda item: distance_km(incident_node, item))
        reason = "Quality remains above 75%; divert to a secondary wholesale market."

    if destination is not None:
        destination = nodes[destination["id"]]
    return {
        "intercept_required": quality_percent < 70,
        "tier": tier,
        "action": action,
        "destination": destination,
        "reason": reason,
    }
