"""Shipment-quality supervisor, disruption evaluator, and recovery destination selection."""

from typing import Any

from .route_agent import all_nodes, distance_km, load_network


def evaluate_incident(
    quality_percent: float,
    incident_node: dict[str, Any],
    network: dict[str, list[dict[str, Any]]] | None = None,
    disruption_type: str = "weather",
    original_target_id: str | None = None,
) -> dict[str, Any]:
    """Evaluate 3 exact disruption scenarios:
    1. Traffic Jam / Road Works: switch active navigation to Option 2 Alternative Path via OR-Tools.
    2. Weather & Temp Spikes: 50-75% -> Secondary Local Market, <50% -> Restaurant Flash Sale.
    3. Vehicle Breakdown: >75% -> Replacement Vehicle Dispatched, 50-75% -> Cold Storage, <50% -> Flash Sale.
    """
    network = network or load_network()
    nodes = all_nodes(network)
    disruption_mode = (disruption_type or "weather").lower()

    destination = None
    replacement_vehicle = None
    path_option = None
    primary_blocked = False
    breakdown_alert = None

    # =========================================================================
    # SCENARIO 1: Traffic Jam or Road Works
    # =========================================================================
    if "traffic" in disruption_mode or "road_work" in disruption_mode:
        tier = 1
        action = "detour_traffic"
        status_badge = "Detour Active (Traffic Jam/Road Works)"
        primary_blocked = True
        path_option = "Option 2 (Alternative Path)"

        # Invalidate current best segment, switch to alternative route/mandi
        candidates = [
            m for m in network.get("markets", [])
            if m.get("id") != incident_node.get("id")
        ]
        if original_target_id:
            # Prefer keeping target or alternate mandi
            target_cand = [m for m in candidates if m.get("id") == original_target_id]
            destination = target_cand[0] if target_cand else (candidates[0] if candidates else None)
        else:
            destination = min(candidates, key=lambda item: distance_km(incident_node, item)) if candidates else None

        reason = (
            f"Traffic Jam & Road Works detected near {incident_node['name']}. "
            f"Primary segment blocked: switched active navigation to Option 2 (Alternative Path) via OR-Tools."
        )

    # =========================================================================
    # SCENARIO 3: Vehicle Mechanical Breakdown / Repair
    # =========================================================================
    elif "breakdown" in disruption_mode or "mechanical" in disruption_mode or "repair" in disruption_mode:
        breakdown_alert = f"Truck TRK-102 stopped for repair at {incident_node['name']}"
        if quality_percent > 75.0:
            tier = 1
            action = "replacement_vehicle"
            status_badge = "Replacement Vehicle Dispatched"
            destination = None
            replacement_vehicle = {
                "id": "TRK-103",
                "name": "Mahindra Furio 11 (Rapid Relief)",
                "driver": "Selvam M.",
                "phone": "+91 97890-54321",
                "capacity_kg": 2500,
                "eta_minutes": 18,
                "status": "DISPATCHED",
            }
            reason = (
                f"Vehicle TRK-102 stopped for mechanical repair at {incident_node['name']}. "
                f"Cargo quality remains excellent ({quality_percent:.1f}%): dispatched relief vehicle TRK-103 to transship load."
            )
        elif quality_percent >= 50.0:
            tier = 2
            action = "cold_storage"
            status_badge = "Emergency Cold Storage Reroute"
            candidates = network.get("cold_storages", [])
            destination = min(candidates, key=lambda item: distance_km(incident_node, item)) if candidates else None
            reason = (
                f"Vehicle breakdown at {incident_node['name']}. "
                f"Cargo freshness at {quality_percent:.1f}%: towing immobilized load to nearest cold chain hub to arrest decay."
            )
        else:
            tier = 3
            action = "flash_sale"
            status_badge = "Flash Sale Triggered (Breakdown)"
            destination = None
            reason = (
                f"Truck TRK-102 immobilized for repair at {incident_node['name']}. "
                f"Freshness dropped to {quality_percent:.1f}%: transport cancelled, batch liquidated to local restaurants."
            )

    # =========================================================================
    # SCENARIO 2: Weather & Container Temp Spikes (Quality Loss)
    # =========================================================================
    else:
        if quality_percent < 50.0:
            tier = 3
            action = "flash_sale"
            status_badge = "Flash Sale Active (<50% Quality)"
            destination = None
            reason = (
                f"Severe container temp spike causing rapid decay ({quality_percent:.1f}% remaining). "
                f"Triggered immediate distress clearance on Restaurant Flash Sales Portal."
            )
        elif quality_percent <= 75.0:
            tier = 2
            action = "secondary_market"
            status_badge = "Rerouted to Secondary Local Market"
            # Assign alternative secondary local mandi
            candidates = [
                m for m in network.get("markets", [])
                if m.get("id") != incident_node.get("id") and m.get("id") != original_target_id
            ]
            if not candidates:
                candidates = network.get("markets", [])
            destination = min(candidates, key=lambda item: distance_km(incident_node, item)) if candidates else None
            dest_name = destination.get("name", "local mandi") if destination else "local mandi"
            reason = (
                f"Container temp spike degraded freshness to {quality_percent:.1f}%. "
                f"Assigned alternative secondary local mandi '{dest_name}' within safe delivery window."
            )
        else:
            tier = 1
            action = "safe_transit"
            status_badge = "Safe Transit (Nominal Quality)"
            destination = None
            reason = f"Cargo freshness remains nominal at {quality_percent:.1f}%. Continuing along optimal route."

    if destination is not None and isinstance(destination, dict) and "id" in destination:
        destination = nodes.get(destination["id"], destination)

    return {
        "intercept_required": quality_percent < 70,
        "tier": tier,
        "action": action,
        "status_badge": status_badge,
        "destination": destination,
        "replacement_vehicle": replacement_vehicle,
        "path_option": path_option,
        "primary_blocked": primary_blocked,
        "breakdown_alert": breakdown_alert,
        "reason": reason,
        "disruption_type": disruption_mode,
    }
