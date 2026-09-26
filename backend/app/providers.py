import asyncio
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

from .config import get_settings

MODELS = {
    "gfs": ("NCEP GFS", "ncep_gfs_global", "forecast"),
    "ifs": ("ECMWF IFS HRES", "ecmwf_ifs025", "forecast"),
    "aifs": ("ECMWF AIFS", "ecmwf_aifs025_single", "forecast"),
    "gfs_ensemble": ("GFS Ensemble Mean", "ncep_hgefs025_ensemble_mean", "forecast"),
}
CACHE: dict[str, tuple[float, Any]] = {}


@dataclass
class ProviderResult:
    key: str
    label: str
    available: bool
    error: str | None
    run_time: datetime | None
    times: list[datetime]
    values: dict[str, list[float | None]]


class ProviderError(RuntimeError):
    pass


async def _json(url: str, params: dict, key: str) -> dict:
    settings = get_settings()
    now = time.monotonic()
    for expired_key in [cache_key for cache_key, (created, _) in CACHE.items() if now - created >= settings.cache_ttl_seconds]:
        CACHE.pop(expired_key, None)
    cached = CACHE.get(key)
    if cached and now - cached[0] < settings.cache_ttl_seconds:
        return cached[1]
    timeout = httpx.Timeout(settings.provider_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        last_error = None
        for attempt in range(2):
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                result = response.json()
                CACHE[key] = (time.monotonic(), result)
                return result
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                if attempt == 0:
                    await asyncio.sleep(0.25)
        raise ProviderError(f"Upstream request failed: {type(last_error).__name__}") from last_error


async def geocode(district: str, state: str) -> dict:
    settings = get_settings()
    params = {"name": f"{district}, {state}", "countryCode": "IN", "count": 5, "language": "en"}
    payload = await _json(settings.open_meteo_geocoding_url, params, f"geo:{district}:{state}".casefold())
    results = payload.get("results", [])
    if not results:
        raise ProviderError(f"No Open-Meteo location match for {district}, {state}, India")
    place = next((item for item in results if item.get("admin1", "").casefold() == state.casefold()), results[0])
    if place.get("country_code") != "IN":
        raise ProviderError("Geocoder did not return an India location")
    return {"name": place["name"], "district": district, "state": place.get("admin1", state), "country": place.get("country", "India"), "latitude": place["latitude"], "longitude": place["longitude"], "timezone": place.get("timezone", "Asia/Kolkata")}


def _parse_model(key: str, label: str, payload: dict) -> ProviderResult:
    hourly = payload.get("hourly") or {}
    times = [datetime.fromisoformat(value) for value in hourly.get("time", [])]
    fields = {
        "temperature": hourly.get("temperature_2m", []),
        "rainfall": hourly.get("rain", []),
        "wind_speed": hourly.get("wind_speed_10m", []),
        "wind_direction": hourly.get("wind_direction_10m", []),
    }
    values = {name: [None if value is None else float(value) for value in series] for name, series in fields.items()}
    # Open-Meteo's standard forecast response does not identify each model's initialization run.
    return ProviderResult(key, label, True, None, None, times, values)


async def fetch_model(key: str, location: dict, forecast_days: int = 4) -> ProviderResult:
    label, model, _ = MODELS[key]
    settings = get_settings()
    params = {
        "latitude": location["latitude"], "longitude": location["longitude"], "models": model,
        "hourly": "temperature_2m,rain,wind_speed_10m,wind_direction_10m",
        "forecast_days": forecast_days, "timezone": location.get("timezone", "Asia/Kolkata"),
        "wind_speed_unit": "kmh", "precipitation_unit": "mm", "temperature_unit": "celsius",
    }
    cache_key = f"model:{key}:{location['latitude']}:{location['longitude']}:{forecast_days}"
    try:
        payload = await _json(settings.open_meteo_forecast_url, params, cache_key)
        return _parse_model(key, label, payload)
    except ProviderError as exc:
        return ProviderResult(key, label, False, str(exc), None, [], {"temperature": [], "rainfall": [], "wind_speed": [], "wind_direction": []})


async def fetch_all(location: dict) -> list[ProviderResult]:
    results = await asyncio.gather(*(fetch_model(key, location) for key in MODELS))
    return list(results)


async def fetch_current(location: dict) -> dict[str, float | str | None] | None:
    """Fetch the provider's current-condition snapshot separately from forecast hours."""
    settings = get_settings()
    params = {
        "latitude": location["latitude"], "longitude": location["longitude"],
        "current": "temperature_2m,rain,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover",
        "timezone": location.get("timezone", "Asia/Kolkata"), "wind_speed_unit": "kmh",
        "precipitation_unit": "mm", "temperature_unit": "celsius",
    }
    try:
        payload = await _json(settings.open_meteo_forecast_url, params, f"current:{location['latitude']}:{location['longitude']}")
    except ProviderError:
        return None
    current = payload.get("current") or {}
    if not current:
        return None
    return {
        "time": current.get("time"), "temperature_c": current.get("temperature_2m"),
        "rainfall_mm": current.get("rain"), "relative_humidity_percent": current.get("relative_humidity_2m"),
        "apparent_temperature_c": current.get("apparent_temperature"), "wind_speed_kmh": current.get("wind_speed_10m"),
        "wind_direction_deg": current.get("wind_direction_10m"), "wind_gusts_kmh": current.get("wind_gusts_10m"),
        "cloud_cover_percent": current.get("cloud_cover"),
    }
