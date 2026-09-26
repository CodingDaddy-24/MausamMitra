from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    region: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    district: str = Field(min_length=2, max_length=100)
    lead_hours: Literal[24, 48, 72] = 24


class RiskIndicator(BaseModel):
    parameter: str
    severity: Literal["NORMAL", "YELLOW", "ORANGE", "RED"]
    value: float
    unit: str
    message: str


class HourlyPoint(BaseModel):
    time: datetime
    rainfall_mm: float | None = None
    temperature_c: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None


class ProviderForecast(BaseModel):
    provider: str
    label: str
    available: bool
    error: str | None = None
    run_time: datetime | None = None
    hourly: list[HourlyPoint] = []


class ForecastResponse(BaseModel):
    location: dict
    lead_hours: int
    generated_at: datetime
    source_run: datetime | None
    blend_method: str
    weighting_note: str
    providers: list[ProviderForecast]
    current: dict[str, float | str | None] | None = None
    blended_hourly: list[HourlyPoint]
    summary: dict[str, float | str | None]
    weights: dict[str, float]
    variable_weights: dict[str, dict[str, float]]
    risks: list[RiskIndicator]
