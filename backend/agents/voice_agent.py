"""Grok-backed voice-intent extraction with a local no-key parser."""

import json
import os
import re
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "report_route_incident",
        "description": "Extract shipment delay, temperature, and affected route node.",
        "parameters": {
            "type": "object",
            "properties": {
                "delay_mins": {"type": "integer", "minimum": 0},
                "temp_celsius": {"type": "number", "minimum": -50, "maximum": 80},
                "node_id": {"type": "string"},
            },
            "required": ["delay_mins", "temp_celsius", "node_id"],
            "additionalProperties": False,
        },
    },
}


def _local_parse(text: str) -> dict[str, Any]:
    delay_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b", text, re.I)
    temp_match = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:°\s*)?(?:celsius|degrees?\s*c|°?c)\b", text, re.I)
    node_match = re.search(r"\bnode\s*[_ -]?\s*([a-z0-9]+)\b", text, re.I)
    if not delay_match or not temp_match or not node_match:
        raise ValueError(
            "Could not identify all incident details. Include a delay in minutes, "
            "a temperature in °C, and a node (for example: '30 min delay, 34°C at Node B')."
        )
    return {
        "delay_mins": int(float(delay_match.group(1))),
        "temp_celsius": float(temp_match.group(1)),
        "node_id": f"Node_{node_match.group(1).upper()}",
    }


def parse_incident(text: str) -> dict[str, Any]:
    if not text.strip():
        raise ValueError("Voice command text cannot be empty")
    api_key = os.getenv("GROK_API_KEY", "").strip()
    if not api_key:
        return _local_parse(text)

    response = requests.post(
        os.getenv("GROK_API_URL", "https://api.x.ai/v1/chat/completions"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": os.getenv("GROK_MODEL", "grok-3-mini"),
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Extract a route incident from the user's text. For omitted delay use 0; "
                        "for omitted temperature use 20 Celsius; for omitted node use Node_B. "
                        "Normalize node identifiers to Node_X form."
                    ),
                },
                {"role": "user", "content": text},
            ],
            "tools": [TOOL_SCHEMA],
            "tool_choice": {"type": "function", "function": {"name": "report_route_incident"}},
        },
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    try:
        arguments = data["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"]
        parsed = json.loads(arguments) if isinstance(arguments, str) else arguments
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise ValueError("Grok returned an invalid incident response") from error

    try:
        return {
            "delay_mins": int(parsed["delay_mins"]),
            "temp_celsius": float(parsed["temp_celsius"]),
            "node_id": str(parsed["node_id"]),
        }
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("Grok returned incomplete or invalid incident fields") from error


def create_executive_summary(
    node_name: str,
    action: str,
    quality_percent: float,
    value_saved: float,
) -> str:
    action_text = {
        "cold_storage": "rerouted to a cold storage facility",
        "secondary_market": "rerouted to a secondary market",
        "flash_sale": "placed in a nearby flash sale",
        "continue": "the original route is continuing",
    }.get(action, "the shipment recovery plan was updated")
    return (
        f"Spoilage risk detected near {node_name}; the shipment was {action_text}. "
        f"{quality_percent:.1f}% quality remains and approximately ${value_saved:,.0f} "
        "in produce value was retained."
    )
