from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .config import get_settings
from .database import get_db
from .forecasting import _aggregate, build_forecast
from .locations import _center, district_feature_in_state, list_districts, list_regions, list_states
from .providers import ProviderError
from .risk import THRESHOLDS
from .schemas import ForecastRequest, ForecastResponse
from .weighting import PROVIDERS

settings = get_settings()


app = FastAPI(title="MausamMitra API", description="India-focused, multi-model forecast blending and prototype risk indicators.", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "MausamMitra API"}


@app.get("/api/locations/regions")
def regions():
    return {"regions": list_regions()}


@app.get("/api/locations/states")
def states(region: str = Query(min_length=2)):
    return {"states": list_states(region)}


@app.get("/api/locations/districts")
def districts(state: str = Query(min_length=2)):
    return {"districts": list_districts(state)}


def _forecast_request(region: str, state: str, district: str, lead_hours: int) -> ForecastRequest:
    try:
        payload = ForecastRequest(region=region, state=state, district=district, lead_hours=lead_hours)
        if state not in list_states(region) or district not in list_districts(state):
            raise ValueError("Location hierarchy does not match")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Select a valid region, state, district and 24/48/72 hour lead time.") from exc


async def _build(region: str, state: str, district: str, lead_hours: int, session: Session):
    payload = _forecast_request(region, state, district, lead_hours)
    try:
        return await build_forecast(payload, session)
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/forecast", response_model=ForecastResponse)
async def forecast(payload: ForecastRequest, session: Session = Depends(get_db)):
    _forecast_request(payload.region, payload.state, payload.district, payload.lead_hours)
    try:
        return await build_forecast(payload, session)
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/map")
async def weather_map(region: str, state: str, district: str, lead_hours: int = 24, variable: str = "rainfall", model: str = "blended", session: Session = Depends(get_db)):
    if variable not in {"rainfall", "temperature", "wind"}:
        raise HTTPException(status_code=422, detail="variable must be rainfall, temperature, or wind")
    if model not in {"blended", *PROVIDERS}:
        raise HTTPException(status_code=422, detail="model must be blended, gfs, ifs, aifs, or gfs_ensemble")
    _forecast_request(region, state, district, lead_hours)
    feature = district_feature_in_state(district, state)
    if not feature:
        raise HTTPException(status_code=404, detail="District geometry is not available in the supplied GeoJSON")
    result = None
    forecast_error = None
    try:
        result = await _build(region, state, district, lead_hours, session)
    except HTTPException as exc:
        forecast_error = str(exc.detail)
    key = {"rainfall": "rainfall_mm", "temperature": "temperature_c", "wind": "wind_speed_kmh"}[variable]
    forecast_summary = result.summary if result and model == "blended" else None
    if result and model != "blended":
        selected_provider = next((provider for provider in result.providers if provider.provider == model and provider.available), None)
        if selected_provider:
            forecast_summary = _aggregate(selected_provider.hourly, lead_hours)
        else:
            forecast_error = f"{model} is unavailable for this request"
    value = forecast_summary.get(key) if forecast_summary else None
    feature = {**feature, "properties": {**feature["properties"], "Name": feature["properties"].get("Name") or feature["properties"].get("NAME"), "forecast_value": value, "wind_direction_deg": forecast_summary.get("wind_direction_deg") if forecast_summary else None, "variable": variable, "unit": {"rainfall": "mm", "temperature": "°C", "wind": "km/h"}[variable], "source": f"{model} forecast at selected district coordinate" if forecast_summary else None}}
    center = _center(feature)
    location = result.location if result else {"name": district, "district": district, "state": state, "country": "India", "longitude": center[0] if center else None, "latitude": center[1] if center else None}
    return {"type": "FeatureCollection", "features": [feature], "variable": variable, "model": model, "location": location, "summary": forecast_summary, "generated_at": result.generated_at if result else None, "forecast_error": forecast_error, "coverage_note": "Only the selected district is shaded using a forecast at its geocoded representative place. Full grid-based district blending is future scope."}


@app.get("/api/model-comparison")
async def model_comparison(region: str, state: str, district: str, lead_hours: int = 72, variable: str = "temperature", session: Session = Depends(get_db)):
    if variable not in {"rainfall", "temperature", "wind"}:
        raise HTTPException(status_code=422, detail="variable must be rainfall, temperature, or wind")
    _forecast_request(region, state, district, lead_hours)
    result = await _build(region, state, district, lead_hours, session)
    metrics = session.scalars(select(models.SkillMetric).where(models.SkillMetric.variable == variable, models.SkillMetric.location_key.in_([f"{state}|{district}".casefold(), "india"]))).all()
    verified = [row for row in metrics if row.sample_count >= 10]
    return {"location": result.location, "variable": variable, "lead_hours": lead_hours, "providers": result.providers, "blended_hourly": result.blended_hourly, "metrics": [{"provider": row.provider, "mae": row.mae, "rmse": row.rmse, "correlation": row.correlation, "bias": row.bias, "sample_count": row.sample_count, "reference": row.reference_name, "updated_at": row.updated_at} for row in verified], "metrics_available": bool(verified), "metric_source": "Stored model_skill_metrics records" if verified else None}


@app.get("/api/historical")
def historical(state: str, district: str, days: int = Query(default=14, ge=1, le=90), session: Session = Depends(get_db)):
    location_key = f"{state}|{district}".casefold()
    since = datetime.now(timezone.utc) - timedelta(days=days)
    snapshots = session.scalars(select(models.WeightSnapshot).where(models.WeightSnapshot.location_key == location_key, models.WeightSnapshot.recorded_at >= since).order_by(models.WeightSnapshot.recorded_at)).all()
    metrics = session.scalars(select(models.SkillMetric).where(models.SkillMetric.location_key.in_([location_key, "india"]))).all()
    history = [{"time": row.recorded_at, "provider": row.provider, "variable": row.variable, "weight": row.weight} for row in snapshots]
    return {"location": {"state": state, "district": district}, "days": days, "reference_series": [], "reference_label": None, "model_series": [], "weight_history": history, "metrics_available": bool(metrics), "empty_reason": "No verified hindcast observations are stored yet. Historical model-versus-reference charts will appear when verified records are ingested." if not metrics else None}


@app.get("/api/extreme-weather")
async def extreme_weather(region: str, state: str, district: str, lead_hours: int = 24, session: Session = Depends(get_db)):
    result = await _build(region, state, district, lead_hours, session)
    return {"location": result.location, "lead_hours": lead_hours, "generated_at": result.generated_at, "risks": result.risks, "thresholds": THRESHOLDS, "prototype_notice": "Prototype screening indicators only. These assumptions are not official IMD warnings.", "map": await weather_map(region, state, district, lead_hours, "rainfall", session)}


@app.get("/api/model-comparison/metrics")
def model_metrics(state: str, district: str, variable: str = "temperature", session: Session = Depends(get_db)):
    if variable not in {"rainfall", "temperature", "wind"}:
        raise HTTPException(status_code=422, detail="variable must be rainfall, temperature, or wind")
    location_key = f"{state}|{district}".casefold()
    records = session.scalars(select(models.SkillMetric).where(models.SkillMetric.variable == variable, models.SkillMetric.location_key.in_([location_key, "india"]))).all()
    verified = [row for row in records if row.sample_count >= 10]
    return {"metrics": [{"provider": row.provider, "mae": row.mae, "rmse": row.rmse, "correlation": row.correlation, "bias": row.bias, "sample_count": row.sample_count, "reference": row.reference_name, "updated_at": row.updated_at} for row in verified], "metrics_available": bool(verified), "providers": list(PROVIDERS)}
