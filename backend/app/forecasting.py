import math
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import SkillMetric, WeightSnapshot
from .providers import MODELS, ProviderResult, fetch_all, geocode
from .risk import evaluate_risks
from .schemas import ForecastResponse, HourlyPoint, ProviderForecast
from .weighting import PROVIDERS, inverse_error_weights

VARIABLE_TO_METRIC = {"rainfall": "rainfall", "temperature": "temperature", "wind": "wind"}


def _skill_rows(session: Session, variable: str, location_key: str) -> dict[str, dict]:
    rows = session.scalars(select(SkillMetric).where(SkillMetric.variable == variable, SkillMetric.location_key.in_([location_key, "INDIA"]))).all()
    # Prefer location-specific skill, then national metrics; never blend unlike variable units.
    selected: dict[str, SkillMetric] = {}
    for row in rows:
        current = selected.get(row.provider)
        if row.sample_count >= 10 and (current is None or row.location_key == location_key):
            selected[row.provider] = row
    return {provider: {"mae": row.mae, "rmse": row.rmse} for provider, row in selected.items()}


def blend_series(providers: list[ProviderResult], variable_weights: dict[str, dict[str, float]]) -> list[HourlyPoint]:
    by_key = {item.key: item for item in providers if item.available}
    timeline = sorted({time for item in by_key.values() for time in item.times})
    output: list[HourlyPoint] = []
    for moment in timeline:
        at_time: dict[str, dict[str, float | None]] = {}
        for key, item in by_key.items():
            try:
                index = item.times.index(moment)
            except ValueError:
                continue
            at_time[key] = {name: values[index] if index < len(values) else None for name, values in item.values.items()}

        def average(field: str, metric: str) -> float | None:
            weights = variable_weights[metric]
            values = [(row[field], weights.get(key, 0.0)) for key, row in at_time.items() if row.get(field) is not None]
            total = sum(weight for _, weight in values)
            return sum(float(value) * weight for value, weight in values) / total if total else None

        speed = average("wind_speed", "wind")
        direction_rows = [(row.get("wind_speed"), row.get("wind_direction"), variable_weights["wind"].get(key, 0.0)) for key, row in at_time.items() if row.get("wind_speed") is not None and row.get("wind_direction") is not None]
        u = sum(-float(s) * math.sin(math.radians(float(d))) * w for s, d, w in direction_rows)
        v = sum(-float(s) * math.cos(math.radians(float(d))) * w for s, d, w in direction_rows)
        direction = (math.degrees(math.atan2(-u, -v)) + 360) % 360 if direction_rows and (u or v) else None
        output.append(HourlyPoint(time=moment, rainfall_mm=average("rainfall", "rainfall"), temperature_c=average("temperature", "temperature"), wind_speed_kmh=speed, wind_direction_deg=direction))
    return output


def _aggregate(points: list[HourlyPoint], lead_hours: int) -> dict:
    start = points[0].time if points else None
    end = start.timestamp() + lead_hours * 3600 if start else None
    window = [point for point in points if start and point.time.timestamp() < end]
    rain = [point.rainfall_mm for point in window if point.rainfall_mm is not None]
    temperatures = [point.temperature_c for point in window if point.temperature_c is not None]
    winds = [point.wind_speed_kmh for point in window if point.wind_speed_kmh is not None]
    peak = max((point for point in window if point.wind_speed_kmh is not None), key=lambda point: point.wind_speed_kmh or 0, default=None)
    return {
        "rainfall_mm": round(sum(rain), 1) if rain else None,
        "temperature_c": round(max(temperatures), 1) if temperatures else None,
        "wind_speed_kmh": round(max(winds), 1) if winds else None,
        "wind_direction_deg": round(peak.wind_direction_deg) % 360 if peak and peak.wind_direction_deg is not None else None,
        "from": start.isoformat() if start else None,
        "to": datetime.fromtimestamp(end, timezone.utc).isoformat() if end else None,
    }


async def build_forecast(request, session: Session) -> ForecastResponse:
    location = await geocode(request.district, request.state)
    provider_results = await fetch_all(location)
    if not any(item.available for item in provider_results):
        raise RuntimeError("All forecast providers are unavailable. Check provider status and try again.")

    location_key = f"{request.state}|{request.district}".casefold()
    variable_weights: dict[str, dict[str, float]] = {}
    notes: list[str] = []
    for variable, metric_key in VARIABLE_TO_METRIC.items():
        weights, note = inverse_error_weights(_skill_rows(session, variable, location_key))
        variable_weights[metric_key] = weights
        notes.append(note)
        for provider, weight in weights.items():
            session.add(WeightSnapshot(provider=provider, variable=metric_key, location_key=location_key, weight=weight, method=note))
    session.commit()

    blended = blend_series(provider_results, variable_weights)
    summary = _aggregate(blended, request.lead_hours)
    # The overall display is the mean of the three variable-specific skill weights.
    all_provider_keys = {item.key for item in provider_results if item.available}
    display_weights = {provider: sum(variable_weights[variable].get(provider, 0) for variable in variable_weights) / len(variable_weights) for provider in all_provider_keys}
    total = sum(display_weights.values())
    display_weights = {provider: weight / total for provider, weight in display_weights.items()} if total else {}
    forecast_rows = []
    for result in provider_results:
        hourly = []
        for index, moment in enumerate(result.times):
            if blended and moment.timestamp() > blended[0].time.timestamp() + request.lead_hours * 3600:
                break
            values = result.values
            hourly.append(HourlyPoint(time=moment, rainfall_mm=values["rainfall"][index] if index < len(values["rainfall"]) else None, temperature_c=values["temperature"][index] if index < len(values["temperature"]) else None, wind_speed_kmh=values["wind_speed"][index] if index < len(values["wind_speed"]) else None, wind_direction_deg=values["wind_direction"][index] if index < len(values["wind_direction"]) else None))
        forecast_rows.append(ProviderForecast(provider=result.key, label=result.label, available=result.available, error=result.error, run_time=result.run_time, hourly=hourly))

    risk_window = _aggregate(blended, 24)
    risks = evaluate_risks(risk_window["rainfall_mm"] or 0, risk_window["wind_speed_kmh"] or 0, risk_window["temperature_c"] or 0)
    available_runs = [item.run_time for item in provider_results if item.available and item.run_time]
    return ForecastResponse(location=location, lead_hours=request.lead_hours, generated_at=datetime.now(timezone.utc), source_run=max(available_runs) if available_runs else None, blend_method="Per-variable inverse-error weighting with vector-averaged wind direction", weighting_note=" ".join(sorted(set(notes))), providers=forecast_rows, blended_hourly=blended, summary=summary, weights=display_weights, variable_weights=variable_weights, risks=risks)
