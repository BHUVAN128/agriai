"""FastAPI entrypoint for the AI Agri-Routing System prototype."""

import os
import time
from datetime import datetime
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from requests import RequestException

from agents.decision_agent import evaluate_incident
from agents.flash_sale_agent import create_flash_sale
from agents.route_agent import (
    all_nodes,
    load_network,
    optimize_initial_route,
    reroute_from_position,
    solve_route,
)
from agents.spoilage_agent import (
    DECAY_COEFFICIENTS,
    calculate_quality,
    estimate_remaining_shelf_life_hours,
)
from agents.voice_agent import create_executive_summary, parse_incident

load_dotenv()
network = load_network()
nodes = all_nodes(network)
PRODUCE_VALUE_PER_KG = {"Tomatoes": 1.8, "Apples": 2.4, "Onions": 1.1}
ProduceType = Literal["Tomatoes", "Apples", "Onions"]

app = FastAPI(
    title="AI Agri-Routing System API",
    description="Perishable-produce route optimization, incident response, and flash-sale simulation.",
    version="2.0.0",
)

# Enable CORS broadly for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# IN-MEMORY STATE FOR REAL-TIME BROADCASTING & MULTI-PORTAL SYNC
# ============================================================================
TRUCKS_STATE = [
    {
        "id": "TRK-101",
        "name": "Eicher Pro 2049 (Reefer)",
        "driver": "Murugan S.",
        "phone": "+91 98421-43210",
        "capacity_kg": 2500,
        "current_load_kg": 2000,
        "produce_type": "Tomatoes",
        "origin_farm": "Perambalur Agro Valley",
        "target_mandi": "Perambalur Uzhavar Sandhai",
        "status": "SAFE",
        "temp_celsius": 18.0,
        "location_name": "NH-38 Bypass Junction",
        "quality_percent": 96.5,
    },
    {
        "id": "TRK-102",
        "name": "Tata 407 Agri Express",
        "driver": "Ravi Kumar",
        "phone": "+91 94432-87654",
        "capacity_kg": 1800,
        "current_load_kg": 1000,
        "produce_type": "Tomatoes",
        "origin_farm": "Chettikulam Organic Fields",
        "target_mandi": "Ariyalur Wholesale Mandi",
        "status": "DISRUPTED",
        "temp_celsius": 34.0,
        "location_name": "Highway Checkpoint B",
        "quality_percent": 43.2,
    },
]

FARMER_ALERTS = [
    {
        "id": "alt_init_1",
        "truck_id": "TRK-102",
        "driver_name": "Ravi Kumar",
        "title": "ALERT: Vehicle TRK-102 stuck near Highway Checkpoint B - Temp spike 34°C",
        "description": "Transit delay +90 min with ambient heat at 34°C. Freshness dropped to 43.2%. Immediate action needed.",
        "checkpoint_name": "Highway Checkpoint B",
        "node_id": "Node_B",
        "temp_celsius": 34.0,
        "delay_mins": 90.0,
        "produce_type": "Tomatoes",
        "quality_percent": 43.2,
        "cargo_value": 1800.0,
        "value_at_risk": 1022.4,
        "recommended_action": "flash_sale",
        "decision_reason": "Quality is at or below 50%; activate a local flash sale.",
        "status": "ACTIVE",
        "created_at": "Just now",
        "timestamp": time.time(),
    }
]

FLASH_DEALS = [
    {
        "id": "deal_init_1",
        "truck_id": "TRK-102",
        "driver_name": "Ravi Kumar",
        "produce_type": "Tomatoes",
        "quantity_kg": 1000,
        "location_name": "Highway Checkpoint B",
        "lat": 18.6102,
        "lon": 73.9165,
        "distance_km": 3.8,
        "original_price": 1800.0,
        "discount_percent": 55,
        "flash_price": 810.0,
        "unit_price_flash": 0.81,
        "quality_percent": 43.2,
        "remaining_hours": 3.5,
        "status": "ACTIVE",
        "claimed_by": None,
        "created_at": "Just now",
        "timestamp": time.time(),
    }
]


# ============================================================================
# REQUEST & RESPONSE SCHEMAS
# ============================================================================
class ShipmentRequest(BaseModel):
    farm_id: str
    target_market_id: str
    produce_type: ProduceType = "Tomatoes"
    capacity_kg: float = Field(default=1000, gt=0, le=100000)


class OptimizeInitialRequest(BaseModel):
    farm_id: str
    produce_type: ProduceType = "Tomatoes"
    capacity_kg: float = Field(default=1000, gt=0, le=100000)
    candidate_market_ids: list[str] | None = None


class IncidentRequest(ShipmentRequest):
    delay_mins: float = Field(default=0, ge=0, le=1440)
    temp_celsius: float = Field(default=20, ge=-50, le=80)
    node_id: str = "Node_B"


class VoiceRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    shipment: ShipmentRequest


class DriverAlertRequest(BaseModel):
    truck_id: str = "TRK-102"
    node_id: str = "Node_B"
    delay_mins: float = 60.0
    temp_celsius: float = 35.0
    produce_type: ProduceType = "Tomatoes"
    capacity_kg: float = 1000.0


class AlertAckRequest(BaseModel):
    alert_id: str
    action: Literal["ACKNOWLEDGE", "AUTHORIZE_REROUTE", "AUTHORIZE_FLASH_SALE"]


class ClaimDealRequest(BaseModel):
    deal_id: str
    buyer_name: str = "Annapoorna Hotel & Bistro"


class RerouteRequest(BaseModel):
    current_lat: float
    current_lon: float
    current_name: str = "Truck Live GPS"
    destination_id: str
    produce_type: ProduceType = "Tomatoes"


def shipment_metrics(
    shipment: ShipmentRequest,
    eta_minutes: float,
    temperature_celsius: float,
) -> dict[str, float]:
    cargo_value = shipment.capacity_kg * PRODUCE_VALUE_PER_KG[shipment.produce_type]
    quality = calculate_quality(
        shipment.produce_type, eta_minutes / 60, temperature_celsius
    )
    return {
        "cargo_value": round(cargo_value, 2),
        "quality_percent": quality,
        "value_at_risk": round(cargo_value * (1 - quality / 100), 2),
    }


# ============================================================================
# CORE ENDPOINTS
# ============================================================================
@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "AI Agri-Routing System V2"}


@app.get("/api/v1/options")
def get_options() -> dict[str, Any]:
    current_net = load_network()
    return {
        "farms": current_net.get("farms", []),
        "markets": current_net.get("markets", []),
        "cold_storages": current_net.get("cold_storages", []),
        "waypoints": current_net.get("waypoints", []),
        "buyers": current_net.get("buyers", []),
        "trucks": current_net.get("trucks", TRUCKS_STATE),
        "produce_types": [
            {"name": name, "decay_coefficient": coefficient}
            for name, coefficient in DECAY_COEFFICIENTS.items()
        ],
    }


@app.post("/api/v1/route")
def create_route(shipment: ShipmentRequest) -> dict[str, Any]:
    current_net = load_network()
    current_nodes = all_nodes(current_net)
    if shipment.farm_id not in current_nodes:
        raise HTTPException(status_code=404, detail="Selected farm was not found")
    if shipment.target_market_id not in current_nodes:
        raise HTTPException(status_code=404, detail="Selected target market was not found")
    try:
        route = solve_route(
            shipment.farm_id,
            shipment.target_market_id,
            produce_type=shipment.produce_type,
            network=current_net,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    metrics = shipment_metrics(shipment, route["eta_minutes"], 20.0)
    return {
        **route,
        **metrics,
        "temperature_celsius": 20.0,
        "produce_type": shipment.produce_type,
        "capacity_kg": shipment.capacity_kg,
        "route_status": "safe",
    }


@app.post("/api/v1/optimize-initial-route")
def optimize_initial_route_endpoint(request: OptimizeInitialRequest) -> dict[str, Any]:
    """Google OR-Tools multi-node destination optimization with spoilage decay penalty."""
    current_net = load_network()
    try:
        result = optimize_initial_route(
            farm_id=request.farm_id,
            produce_type=request.produce_type,
            capacity_kg=request.capacity_kg,
            candidate_market_ids=request.candidate_market_ids,
            network=current_net,
        )
        return result
    except ValueError as err:
        raise HTTPException(status_code=422, detail=str(err)) from err


def simulate_incident(
    shipment: ShipmentRequest,
    delay_mins: float,
    temp_celsius: float,
    node_id: str,
) -> dict[str, Any]:
    current_net = load_network()
    current_nodes = all_nodes(current_net)
    if shipment.farm_id not in current_nodes or shipment.target_market_id not in current_nodes:
        raise HTTPException(status_code=404, detail="Selected shipment location was not found")
    incident_node = current_nodes.get(node_id)
    if incident_node is None:
        raise HTTPException(status_code=404, detail=f"Incident node '{node_id}' was not found")

    original_route = solve_route(
        shipment.farm_id,
        shipment.target_market_id,
        produce_type=shipment.produce_type,
        network=current_net,
    )
    baseline_quality = calculate_quality(
        shipment.produce_type, original_route["eta_minutes"] / 60, 20.0
    )
    total_elapsed_hours = (original_route["eta_minutes"] + delay_mins) / 60
    quality = calculate_quality(
        shipment.produce_type, total_elapsed_hours, temp_celsius
    )
    decision = evaluate_incident(quality, incident_node, current_net)
    cargo_value = shipment.capacity_kg * PRODUCE_VALUE_PER_KG[shipment.produce_type]
    result: dict[str, Any] = {
        "original_route": original_route,
        "route": original_route,
        "baseline_quality_percent": baseline_quality,
        "quality_percent": quality,
        "cargo_value": round(cargo_value, 2),
        "value_at_risk": round(cargo_value * (1 - quality / 100), 2),
        "delay_mins": round(delay_mins, 1),
        "temperature_celsius": temp_celsius,
        "incident_node": incident_node,
        "decision": decision,
        "route_status": "warning",
        "flash_sale": None,
    }

    if decision["action"] in {"cold_storage", "secondary_market"}:
        destination = decision["destination"]
        try:
            detour = solve_route(
                node_id,
                destination["id"],
                produce_type=shipment.produce_type,
                network=current_net,
            )
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        result["detour_route"] = detour
        result["route_status"] = "rerouted"
        value_saved = cargo_value * quality / 100
    elif decision["action"] == "flash_sale":
        shelf_life = estimate_remaining_shelf_life_hours(
            shipment.produce_type, quality, temp_celsius
        )
        result["flash_sale"] = create_flash_sale(
            shipment.produce_type,
            quality,
            cargo_value,
            incident_node,
            current_net.get("buyers", []),
            shelf_life,
        )
        result["remaining_shelf_life_hours"] = shelf_life
        result["route_status"] = "flash_sale"
        value_saved = result["flash_sale"]["sale_value"]
    else:
        value_saved = 0.0

    result["value_saved"] = round(value_saved, 2)
    result["loss_prevented"] = round(value_saved, 2)
    result["estimated_loss"] = round(max(0.0, cargo_value - value_saved), 2)
    result["summary"] = create_executive_summary(
        incident_node["name"], decision["action"], quality, value_saved
    )

    # ------------------------------------------------------------------------
    # REAL-TIME BROADCAST: SYNC TO FARMER ALERTS & RESTAURANT FLASH SALES
    # ------------------------------------------------------------------------
    now_str = datetime.now().strftime("%H:%M:%S")
    alert_obj = {
        "id": f"alt_{int(time.time()*1000)}",
        "truck_id": "TRK-102",
        "driver_name": "Ravi Kumar",
        "title": f"ALERT: Vehicle TRK-102 disrupted near {incident_node['name']}",
        "description": f"Temp spike {temp_celsius}°C · Transit delay +{delay_mins} min · Quality degraded to {quality:.1f}%.",
        "checkpoint_name": incident_node["name"],
        "node_id": node_id,
        "temp_celsius": temp_celsius,
        "delay_mins": delay_mins,
        "produce_type": shipment.produce_type,
        "quality_percent": quality,
        "cargo_value": round(cargo_value, 2),
        "value_at_risk": round(cargo_value * (1 - quality / 100), 2),
        "recommended_action": decision["action"],
        "decision_reason": decision["reason"],
        "status": "ACTIVE",
        "created_at": now_str,
        "timestamp": time.time(),
    }
    FARMER_ALERTS.insert(0, alert_obj)

    # Update truck status
    for trk in TRUCKS_STATE:
        if trk["id"] == "TRK-102":
            trk["status"] = "FLASH_SALE" if decision["action"] == "flash_sale" else "REROUTED"
            trk["temp_celsius"] = temp_celsius
            trk["quality_percent"] = quality
            trk["location_name"] = incident_node["name"]

    # Trigger flash sale deal if quality <= 50% or flash sale action chosen
    if decision["action"] == "flash_sale" or quality <= 50.0:
        disc = 50 if quality > 40 else 60
        deal_obj = {
            "id": f"deal_{int(time.time()*1000)}",
            "truck_id": "TRK-102",
            "driver_name": "Ravi Kumar",
            "produce_type": shipment.produce_type,
            "quantity_kg": shipment.capacity_kg,
            "location_name": incident_node["name"],
            "lat": incident_node["lat"],
            "lon": incident_node["lon"],
            "distance_km": round(3.5 + (len(FLASH_DEALS) * 0.4), 1),
            "original_price": round(cargo_value, 2),
            "discount_percent": disc,
            "flash_price": round(cargo_value * (1 - disc / 100), 2),
            "unit_price_flash": round((cargo_value * (1 - disc / 100)) / shipment.capacity_kg, 2),
            "quality_percent": quality,
            "remaining_hours": round(result.get("remaining_shelf_life_hours", 4.0), 1),
            "status": "ACTIVE",
            "claimed_by": None,
            "created_at": now_str,
            "timestamp": time.time(),
        }
        FLASH_DEALS.insert(0, deal_obj)

    return result


@app.post("/api/v1/simulate")
def simulate(request: IncidentRequest) -> dict[str, Any]:
    return simulate_incident(
        request,
        request.delay_mins,
        request.temp_celsius,
        request.node_id,
    )


@app.post("/api/v1/voice-command")
def voice_command(request: VoiceRequest) -> dict[str, Any]:
    try:
        incident = parse_incident(request.text)
    except RequestException as error:
        raise HTTPException(status_code=502, detail=f"Grok request failed: {error}") from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    result = simulate_incident(
        request.shipment,
        incident["delay_mins"],
        incident["temp_celsius"],
        incident["node_id"],
    )
    return {"incident": incident, **result}


# ============================================================================
# NEW FARMER PORTAL & TRUCK ALERTS ENDPOINTS
# ============================================================================
@app.get("/api/v1/farmer-alerts")
def get_farmer_alerts() -> dict[str, Any]:
    """Returns active disruption alerts and vehicle status feed for farmers."""
    return {
        "alerts": FARMER_ALERTS[:15],
        "trucks": TRUCKS_STATE,
        "unread_count": len([a for a in FARMER_ALERTS if a["status"] == "ACTIVE"]),
    }


@app.post("/api/v1/farmer-alerts/ack")
def acknowledge_farmer_alert(request: AlertAckRequest) -> dict[str, Any]:
    """Allows farmer to acknowledge alert or authorize reroute / flash sale liquidation."""
    for alert in FARMER_ALERTS:
        if alert["id"] == request.alert_id:
            alert["status"] = request.action
            return {"status": "ok", "alert": alert}
    raise HTTPException(status_code=404, detail="Alert not found")


@app.post("/api/v1/farmer-alerts/create")
def create_driver_alert(request: DriverAlertRequest) -> dict[str, Any]:
    """Direct driver distress alert endpoint."""
    fake_shipment = ShipmentRequest(
        farm_id="farm_perambalur_valley",
        target_market_id="market_perambalur_mandi",
        produce_type=request.produce_type,
        capacity_kg=request.capacity_kg,
    )
    return simulate_incident(
        shipment=fake_shipment,
        delay_mins=request.delay_mins,
        temp_celsius=request.temp_celsius,
        node_id=request.node_id,
    )


# ============================================================================
# NEW BUYER & RESTAURANT FLASH SALES ENDPOINTS
# ============================================================================
@app.get("/api/v1/flash-deals")
def get_flash_deals() -> dict[str, Any]:
    """Returns live distressed produce batches currently offered for Flash Sale."""
    return {
        "deals": FLASH_DEALS[:20],
        "active_count": len([d for d in FLASH_DEALS if d["status"] == "ACTIVE"]),
    }


@app.post("/api/v1/flash-deals/claim")
def claim_flash_deal(request: ClaimDealRequest) -> dict[str, Any]:
    """Allows restaurants/buyers to claim or reserve a distressed batch at discount."""
    for deal in FLASH_DEALS:
        if deal["id"] == request.deal_id:
            if deal["status"] == "CLAIMED":
                raise HTTPException(status_code=400, detail="This batch has already been reserved")
            deal["status"] = "CLAIMED"
            deal["claimed_by"] = request.buyer_name
            deal["claimed_at"] = datetime.now().strftime("%H:%M:%S")
            return {
                "status": "success",
                "message": f"Successfully reserved {deal['quantity_kg']}kg of {deal['produce_type']} for {request.buyer_name}!",
                "deal": deal,
            }
    raise HTTPException(status_code=404, detail="Deal not found")


@app.post("/api/v1/reroute")
def reroute_endpoint(request: RerouteRequest) -> dict[str, Any]:
    """Reroute dynamically from truck's current position to destination."""
    try:
        route = reroute_from_position(
            current_lat=request.current_lat,
            current_lon=request.current_lon,
            current_name=request.current_name,
            destination_id=request.destination_id,
            produce_type=request.produce_type,
            network=load_network(),
        )
        return route
    except Exception as err:
        raise HTTPException(status_code=422, detail=str(err)) from err
