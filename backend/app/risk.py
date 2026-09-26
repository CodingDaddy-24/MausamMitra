from .schemas import RiskIndicator

THRESHOLDS = {
    "rainfall": {"unit": "mm / 24h", "yellow": (15.5, 64.4), "orange": (64.5, 115.5), "red": (115.5, None)},
    "wind": {"unit": "km/h", "yellow": (40.0, 60.0), "orange": (60.0, 80.0), "red": (80.0, None)},
    "heat": {"unit": "°C", "yellow": (37.0, 40.0), "orange": (40.0, 43.0), "red": (43.0, None)},
}


def classify(parameter: str, value: float) -> RiskIndicator:
    config = THRESHOLDS[parameter]
    severity = "NORMAL"
    if parameter == "rainfall":
        if value > 115.5:
            severity = "RED"
        elif 64.4 < value <= 115.5:
            severity = "ORANGE"
        elif 15.5 <= value <= 64.4:
            severity = "YELLOW"
    elif parameter == "wind":
        if value > 80:
            severity = "RED"
        elif 60 <= value <= 80:
            severity = "ORANGE"
        elif 40 <= value < 60:
            severity = "YELLOW"
    else:
        if value > 43:
            severity = "RED"
        elif 40 <= value <= 43:
            severity = "ORANGE"
        elif 37 <= value < 40:
            severity = "YELLOW"
    message = "No significant threshold exceedance detected." if severity == "NORMAL" else f"{severity.title()} prototype threshold reached for {parameter}."
    return RiskIndicator(parameter=parameter, severity=severity, value=round(value, 1), unit=config["unit"], message=message)


def evaluate_risks(rainfall_24h: float, wind_max: float, temperature_max: float) -> list[RiskIndicator]:
    return [classify("rainfall", rainfall_24h), classify("wind", wind_max), classify("heat", temperature_max)]
