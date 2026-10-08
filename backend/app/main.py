"""FastAPI entrypoint for the AI Agri-Routing System prototype."""

import os
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from requests import RequestException

from agents.decision_agent import evaluate_incident
from agents.flash_sale_agent import create_flash_sale
from agents.route_agent import all_nodes, load_network, solve_route
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
    version="1.0.0",
)
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ShipmentRequest(BaseModel):
    farm_id: str
    target_market_id: str
    produce_type: ProduceType
    capacity_kg: float = Field(default=1000, gt=0, le=100000)


class IncidentRequest(ShipmentRequest):
    delay_mins: float = Field(default=0, ge=0, le=1440)
    temp_celsius: float = Field(default=20, ge=-50, le=80)
    node_id: str = "Node_B"


class VoiceRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    shipment: ShipmentRequest


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


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "AI Agri-Routing System"}


@app.get("/api/v1/options")
def get_options() -> dict[str, Any]:
    return {
        "farms": network["farms"],
        "markets": network["markets"],
        "cold_storages": network["cold_storages"],
        "waypoints": network["waypoints"],
        "produce_types": [
            {"name": name, "decay_coefficient": coefficient}
            for name, coefficient in DECAY_COEFFICIENTS.items()
        ],
    }


@app.post("/api/v1/route")
def create_route(shipment: ShipmentRequest) -> dict[str, Any]:
    if shipment.farm_id not in nodes or shipment.farm_id not in {
        farm["id"] for farm in network["farms"]
    }:
        raise HTTPException(status_code=404, detail="Selected farm was not found")
    if shipment.target_market_id not in {
        market["id"] for market in network["markets"]
    }:
        raise HTTPException(status_code=404, detail="Selected target market was not found")
    try:
        route = solve_route(
            shipment.farm_id,
            shipment.target_market_id,
            produce_type=shipment.produce_type,
            network=network,
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


def simulate_incident(
    shipment: ShipmentRequest,
    delay_mins: float,
    temp_celsius: float,
    node_id: str,
) -> dict[str, Any]:
    if shipment.farm_id not in nodes or shipment.target_market_id not in nodes:
        raise HTTPException(status_code=404, detail="Selected shipment location was not found")
    incident_node = nodes.get(node_id)
    if incident_node is None or node_id not in {
        item["id"] for item in network["waypoints"]
    }:
        raise HTTPException(status_code=404, detail=f"Incident node '{node_id}' was not found")

    original_route = solve_route(
        shipment.farm_id,
        shipment.target_market_id,
        produce_type=shipment.produce_type,
        network=network,
    )
    baseline_quality = calculate_quality(
        shipment.produce_type, original_route["eta_minutes"] / 60, 20.0
    )
    total_elapsed_hours = (original_route["eta_minutes"] + delay_mins) / 60
    quality = calculate_quality(
        shipment.produce_type, total_elapsed_hours, temp_celsius
    )
    decision = evaluate_incident(quality, incident_node, network)
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
                network=network,
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
            network.get("buyers", []),
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
