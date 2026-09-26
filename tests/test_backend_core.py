from datetime import datetime

from app.providers import ProviderResult
from app.risk import classify
from app.weighting import inverse_error_weights
from app.forecasting import blend_series
from app.main import app
from fastapi.testclient import TestClient
from unittest.mock import patch
from fastapi import HTTPException


def test_inverse_skill_weights_normalize_and_reward_lower_error():
    weights, method = inverse_error_weights({"gfs": {"mae": 1, "rmse": 1}, "ifs": {"mae": 2, "rmse": 2}})
    assert abs(sum(weights.values()) - 1) < 1e-12
    assert weights["gfs"] > weights["ifs"]
    assert "70% MAE" in method


def test_equal_weight_fallback_is_explicit():
    weights, method = inverse_error_weights(None)
    assert len(weights) == 4
    assert all(value == 0.25 for value in weights.values())
    assert "fallback" in method


def test_risk_thresholds_cover_configured_boundaries():
    assert classify("rainfall", 15.5).severity == "YELLOW"
    assert classify("rainfall", 64.5).severity == "ORANGE"
    assert classify("rainfall", 115.6).severity == "RED"
    assert classify("wind", 40).severity == "YELLOW"
    assert classify("wind", 60).severity == "ORANGE"
    assert classify("wind", 80.1).severity == "RED"
    assert classify("heat", 37).severity == "YELLOW"
    assert classify("heat", 40).severity == "ORANGE"
    assert classify("heat", 43.1).severity == "RED"


def test_wind_blending_uses_vector_average_across_north_wrap():
    moment = datetime(2026, 9, 27, 0)
    north = ProviderResult("gfs", "GFS", True, None, None, [moment], {"temperature": [20], "rainfall": [0], "wind_speed": [10], "wind_direction": [350]})
    north_east = ProviderResult("ifs", "IFS", True, None, None, [moment], {"temperature": [22], "rainfall": [2], "wind_speed": [10], "wind_direction": [10]})
    result = blend_series([north, north_east], {"rainfall": {"gfs": 0.5, "ifs": 0.5}, "temperature": {"gfs": 0.5, "ifs": 0.5}, "wind": {"gfs": 0.5, "ifs": 0.5}})
    assert result[0].wind_direction_deg is not None
    assert min(result[0].wind_direction_deg, 360 - result[0].wind_direction_deg) < 1
    assert result[0].temperature_c == 21


def test_health_and_location_endpoints():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"
        assert "Western India" in client.get("/api/locations/regions").json()["regions"]
        assert "Maharashtra" in client.get("/api/locations/states", params={"region": "Western India"}).json()["states"]
        assert "Mumbai" in client.get("/api/locations/districts", params={"state": "Maharashtra"}).json()["districts"]


def test_forecast_api_normalizes_available_sources_and_exposes_failures():
    moment = datetime(2026, 9, 27, 0)
    available = [
        ProviderResult("gfs", "NCEP GFS", True, None, None, [moment], {"temperature": [30], "rainfall": [2], "wind_speed": [10], "wind_direction": [350]}),
        ProviderResult("ifs", "ECMWF IFS HRES", True, None, None, [moment], {"temperature": [32], "rainfall": [4], "wind_speed": [12], "wind_direction": [10]}),
    ]
    missing = [ProviderResult(key, label, False, "Upstream request failed: TimeoutException", None, [], {"temperature": [], "rainfall": [], "wind_speed": [], "wind_direction": []}) for key, label in [("aifs", "ECMWF AIFS"), ("gfs_ensemble", "GFS Ensemble Mean")]]
    with patch("app.forecasting.geocode", return_value={"name": "Mumbai", "district": "Mumbai", "state": "Maharashtra", "country": "India", "latitude": 19.07, "longitude": 72.87, "timezone": "Asia/Kolkata"}), patch("app.forecasting.fetch_all", return_value=available + missing):
        with TestClient(app) as client:
            response = client.post("/api/forecast", json={"region": "Western India", "state": "Maharashtra", "district": "Mumbai", "lead_hours": 24})
    assert response.status_code == 200
    body = response.json()
    assert len(body["providers"]) == 4
    assert body["providers"][2]["available"] is False
    assert abs(body["summary"]["temperature_c"] - 31) < 0.01
    assert abs(sum(body["weights"].values()) - 1) < 1e-9


def test_map_still_returns_boundary_when_live_models_are_down():
    with patch("app.main._build", side_effect=HTTPException(status_code=503, detail="Providers unavailable")):
        with TestClient(app) as client:
            response = client.get("/api/map", params={"region": "Western India", "state": "Maharashtra", "district": "Mumbai", "variable": "rainfall"})
    assert response.status_code == 200
    assert response.json()["features"][0]["properties"]["forecast_value"] is None
    assert response.json()["forecast_error"] == "Providers unavailable"
