"""Mock geo-fenced produce sale and buyer notification generator."""

from typing import Any

from .route_agent import distance_km


def create_flash_sale(
    produce_type: str,
    quality_percent: float,
    cargo_value: float,
    location: dict[str, Any],
    buyers: list[dict[str, Any]],
    remaining_shelf_life_hours: float,
    radius_km: float = 3.5,
) -> dict[str, Any]:
    """Price discounted cargo and create mock alerts inside the configured radius."""
    if not 3.0 <= radius_km <= 5.0:
        raise ValueError("Flash-sale radius must be between 3 and 5 km")
    if cargo_value < 0:
        raise ValueError("Cargo value cannot be negative")

    discount_percent = round(min(60.0, max(40.0, 60.0 - 4.0 * remaining_shelf_life_hours)), 1)
    sale_value = round(cargo_value * (1.0 - discount_percent / 100.0), 2)
    nearby_buyers = [
        {
            "buyer_id": buyer["id"],
            "buyer_name": buyer["name"],
            "distance_km": round(distance_km(location, buyer), 2),
            "message": (
                f"Flash sale: {produce_type} at {discount_percent:.0f}% off. "
                f"{quality_percent:.0f}% quality; limited local availability."
            ),
            "channel": "mock_push_sms",
        }
        for buyer in buyers
        if distance_km(location, buyer) <= radius_km
    ]
    return {
        "discount_percent": discount_percent,
        "original_value": round(cargo_value, 2),
        "sale_value": sale_value,
        "radius_km": radius_km,
        "alerts_sent": len(nearby_buyers),
        "buyers": nearby_buyers,
    }

