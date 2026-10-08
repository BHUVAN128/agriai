"""Temperature-sensitive quality decay calculations for produce shipments."""

from math import exp, log

DECAY_COEFFICIENTS = {
    "Tomatoes": 0.08,
    "Apples": 0.03,
    "Onions": 0.01,
}
TEMPERATURE_SENSITIVITY = 0.03


def calculate_quality(
    produce_type: str,
    elapsed_hours: float,
    temperature_celsius: float = 20.0,
    initial_quality: float = 100.0,
) -> float:
    """Return remaining quality as a percentage using the requested Q(t) model."""
    if produce_type not in DECAY_COEFFICIENTS:
        raise ValueError(f"Unsupported produce type: {produce_type}")
    if elapsed_hours < 0:
        raise ValueError("Elapsed time cannot be negative")
    if not 0.0 <= initial_quality <= 100.0:
        raise ValueError("Initial quality must be between 0 and 100")

    temperature_factor = max(0.0, 1.0 + TEMPERATURE_SENSITIVITY * temperature_celsius)
    quality = initial_quality * exp(
        -DECAY_COEFFICIENTS[produce_type] * temperature_factor * elapsed_hours
    )
    return round(quality, 2)


def estimate_remaining_shelf_life_hours(
    produce_type: str,
    quality_percent: float,
    temperature_celsius: float,
    minimum_quality: float = 50.0,
) -> float:
    """Estimate hours until produce reaches the supplied quality threshold."""
    if produce_type not in DECAY_COEFFICIENTS:
        raise ValueError(f"Unsupported produce type: {produce_type}")
    if not 0.0 < minimum_quality < 100.0:
        raise ValueError("Minimum quality must be between 0 and 100")
    if quality_percent <= minimum_quality:
        return 0.0

    rate = DECAY_COEFFICIENTS[produce_type] * max(
        0.0, 1.0 + TEMPERATURE_SENSITIVITY * temperature_celsius
    )
    if rate == 0.0:
        return 24.0
    return round(max(0.0, -log(minimum_quality / quality_percent) / rate), 2)
