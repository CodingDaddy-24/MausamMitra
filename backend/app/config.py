from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MausamMitra API"
    api_prefix: str = "/api"
    database_url: str
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    open_meteo_forecast_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_geocoding_url: str = "https://geocoding-api.open-meteo.com/v1/search"
    provider_timeout_seconds: float = 12.0
    cache_ttl_seconds: int = 600
    # Keep boundaries inside the backend service root so Vercel bundles them with FastAPI.
    geojson_dir: Path = Path(__file__).resolve().parents[1] / "data" / "geojson" / "india"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
