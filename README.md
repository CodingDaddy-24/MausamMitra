# MausamMitra

**Smart Forecasts for a Safer India**

MausamMitra is an India-focused multi-model forecast MVP for SIH Problem Statement 26081. It retrieves forecasts from public NWP/AI model feeds, normalizes hourly data, calculates a transparent blend, evaluates configurable prototype risk thresholds, and presents forecasts through a React dashboard and Leaflet district map.

## Architecture

```text
React + Vite + TypeScript + Leaflet
               │ HTTP / JSON
               ▼
FastAPI ── Open-Meteo forecast + geocoding APIs
   │
   └── SQLAlchemy ── Supabase-managed PostgreSQL
        ├── verification metrics
        └── forecast weight history
```

The browser calls FastAPI only. Database credentials and any future provider secrets stay on the server. The current Open-Meteo public model requests do not require credentials. The frontend never connects directly to PostgreSQL.

## Technology

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, React Router, Axios, React-Leaflet/Leaflet, Recharts, Lucide
- Backend: Python 3.11+, FastAPI, httpx, Pydantic Settings, SQLAlchemy
- Database: Supabase-managed PostgreSQL (required for app runtime); isolated SQLite is used only by automated tests
- Forecast data: Open-Meteo weather forecast and geocoding APIs
- Administrative data: provided ADM0/ADM1/ADM2 GeoJSON; source and license notes in [`docs/geojson-sources.md`](docs/geojson-sources.md)

## Repository layout

```text
backend/app/                 FastAPI routes, providers, blending, risk, and storage
backend/migrations/          PostgreSQL schema migration
data/geojson/india/          Supplied India administrative boundaries + source metadata
docs/                        API, data source, and methodology notes
frontend/src/components/     Shared selectors, cards, map, charts, and states
frontend/src/pages/          Dashboard, map, comparison, extreme, history
tests/                       Backend and frontend unit/component tests
.env.example                 Environment variable names and safe local defaults
.gitignore                   Secrets, caches, dependency/build outputs, local DB
```

## Environment variables

Copy `.env.example` to `backend/.env` for the server and `frontend/.env.example` to `frontend/.env.local` for Vite. The examples contain placeholders only; never put database credentials in the frontend environment file.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Backend | Required server-only Supabase PostgreSQL URL, preferably the shared transaction pooler URL (port 6543) for Vercel. |
| `CORS_ORIGINS` | Backend | Comma-separated allowed frontend origins. |
| `PROVIDER_TIMEOUT_SECONDS` | Backend | Upstream request timeout. |
| `CACHE_TTL_SECONDS` | Backend | Short in-memory cache for matching provider/geocoding requests. |
| `OPEN_METEO_FORECAST_URL` | Backend | Forecast API endpoint override. |
| `OPEN_METEO_GEOCODING_URL` | Backend | Geocoding API endpoint override. |
| `VITE_BACKEND_URL` | Frontend | FastAPI origin, default `http://localhost:8000`. |
| `VITE_OSM_TILE_URL` | Frontend | OSM-compatible raster tile URL template. |

Never use a `VITE_` variable for service-role keys, passwords, or provider secrets. Use a Supabase PostgreSQL connection string with backend-only access. Database access goes through FastAPI/SQLAlchemy; anonymous/authenticated Data API policies are not created.

## Run locally

### Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
Copy-Item ..\.env.example .env
py -m uvicorn app.main:app --reload
```

The API is at `http://localhost:8000`; interactive OpenAPI docs are at `http://localhost:8000/docs`. Set a valid Supabase `DATABASE_URL` before launching the backend.

MausamMitra requires Supabase Postgres at runtime. Create a Supabase project, apply [`backend/migrations/001_skill_metrics.sql`](backend/migrations/001_skill_metrics.sql) through the Supabase SQL editor or migration workflow, and set `DATABASE_URL` in `backend/.env` to the project's server-side PostgreSQL connection string. For serverless/Vercel, choose Supabase's shared transaction pooler (port 6543); the backend uses SQLAlchemy `NullPool` and disables psycopg prepared statements for that mode. Never put this URL in a `VITE_` variable or commit it.

Copy `.env.example` to `backend/.env`, replace the placeholders with the connection details from Supabase's **Connect → Transaction pooler** panel, URL-encoding reserved characters in the database password, and keep the file private. The local API does not start without `DATABASE_URL`; the app no longer falls back to a local SQLite database. SQLite is permitted only inside pytest's isolated test configuration.

#### Move existing local history

After applying the schema migration and setting `DATABASE_URL` in the shell, copy the existing local SQLite tables into the Supabase project:

```powershell
$env:DATABASE_URL = 'postgresql+psycopg://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require'
py backend/scripts/migrate_sqlite_to_supabase.py --sqlite .\mausammitra.db
```

The script copies `model_skill_metrics` and `weight_history`, preserves record IDs, skips IDs already present, reports inserted counts, and leaves the source SQLite file untouched. The migration must be applied first. The current local database contains 600 `weight_history` rows and no skill metric rows.

### Frontend

In a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
corepack pnpm install
corepack pnpm run dev
```

Vite serves the app at `http://localhost:5173`. The starter location is Mumbai → Maharashtra → Western India; cascading options are read from backend endpoints and supplied boundary files.

### Docker

Docker Compose is not needed for local MVP development. Run the frontend and backend development servers separately and connect the backend to Supabase Postgres. No compose file is included.

## API

All API responses are JSON. FastAPI validates selection and lead time. Errors use HTTP status codes with a detail message; individual upstream source failures are returned alongside successful providers. No provider is silently replaced by another.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Readiness check |
| `GET /api/locations/regions` | Region selector choices |
| `GET /api/locations/states?region=Western%20India` | States for the chosen region |
| `GET /api/locations/districts?state=Maharashtra` | Districts linked to the selected state in supplied boundaries |
| `POST /api/forecast` | Multi-model hourly and blended forecast; body includes `region`, `state`, `district`, `lead_hours` (24/48/72) |
| `GET /api/map?...&variable=rainfall&model=blended` | Selected district GeoJSON with the selected source's forecast value (`blended`, `gfs`, `ifs`, `aifs`, `gfs_ensemble`); boundary still renders if providers are unavailable |
| `GET /api/model-comparison?...&variable=temperature` | Provider/blended time series and stored verification metrics |
| `GET /api/model-comparison/metrics?state=...&district=...&variable=...` | Stored MAE/RMSE/correlation/bias records |
| `GET /api/historical?state=...&district=...&days=14` | Stored weight history and reference-series availability |
| `GET /api/extreme-weather?...` | Forecast-derived risk indicators, thresholds, and selected-area map |

## Weather models and availability

The provider adapters request four Open-Meteo model identifiers in parallel:

- NCEP GFS (`ncep_gfs_global`)
- ECMWF IFS 0.25° (`ecmwf_ifs025`); Open-Meteo's generic endpoint does not offer the separate IFS HRES 9 km product under this identifier
- ECMWF AIFS 0.25° Single (`ecmwf_aifs025_single`)
- NCEP HGEFS 0.25° ensemble mean (`ncep_hgefs025_ensemble_mean`)

The requested HGEFS ensemble mean is an ensemble product, not an independent fourth deterministic model. Each provider has timeout/retry handling, a short cache, and a visible status. An all-provider failure returns an API error. Open-Meteo's standard response does not identify each source's initialization run; the API therefore reports generation time and valid-time series, not a misleading source-run timestamp. Verify current product availability and usage terms before a public/commercial deployment.

## Blending and verification

Rain is summed over the requested lead window; temperature and wind cards show period maxima. Hourly forecasts are aligned by valid timestamp. Each variable receives independent weights. For stored verification records, the skill score is `0.7 × MAE + 0.3 × RMSE`; inverse scores are normalized to sum to 1. Missing or insufficient scores trigger the clearly labeled equal-weight fallback. Wind direction is combined from speed-weighted vector components, avoiding the 359°/1° arithmetic-mean error. Missing providers are excluded at each timestamp and remaining weights are renormalized.

The MVP does not fabricate historical model skill. The `model_skill_metrics` and `weight_history` tables are created at startup; no metric ingest job or source observations are supplied, so comparison metrics and model-vs-reference history remain empty until verified aligned data are ingested. The comparison endpoint is the single metrics source of truth.

## Risk configuration

Thresholds are defined in `backend/app/risk.py` and returned by `/api/extreme-weather`:

| Parameter | Yellow | Orange | Red |
| --- | --- | --- | --- |
| Rain, 24-hour total | 15.5–64.4 mm | 64.5–115.5 mm | >115.5 mm |
| Wind speed | 40–<60 km/h | 60–80 km/h | >80 km/h |
| Temperature | 37–<40 °C | 40–43 °C | >43 °C |

These prototype assumptions are not official IMD warning thresholds. The risk page displays that disclaimer and does not issue public warnings.

## Map and geographic data

The map uses React-Leaflet, selectable rainfall/temperature/wind layers, the selected ADM2 boundary, and the Open-Meteo geocoded representative place. The current map colors only the selected district using the representative-place forecast; it does not claim spatially resolved values for every district. Full gridded field blending is future work. Tile attribution is visible. Public OSM tiles must be used according to the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/); the app does not spoof a User-Agent or bulk-prefetch tiles. Configure a provider that permits your traffic if the public tile service is unsuitable.

Boundary source/attribution and license caveats are in [`docs/geojson-sources.md`](docs/geojson-sources.md). The ADM2 metadata says “Creative Commons 2.0” without identifying its exact variant; verify upstream terms before reuse.

## Tests and build

```powershell
# From repository root
py -m pip install -r backend\requirements.txt
py -m pytest tests\test_backend_core.py

cd frontend
corepack pnpm install
corepack pnpm test
corepack pnpm run build
```

Tests cover normalized skill weights, fallback behavior, configured risk boundaries, circular wind blending, location hierarchy, and backend health. Frontend tests cover risk alert severity selection and the normal alert. The production frontend build runs TypeScript checking before Vite bundling.

## Known limitations

- No verification-data ingestion or scheduled refresh job is included yet. Stored skill metrics are empty until populated from time-aligned forecasts and an explicitly named reference dataset.
- District weights and selected district colors represent one geocoded place, not a spatial forecast grid.
- Standard Open-Meteo results do not identify each model's initialization run; cycle synchronization cannot be verified from those responses.
- The IFS HRES 9 km product is not the same as the Open-Meteo generic endpoint's IFS 0.25° identifier.
- The provided ADM2 boundaries date from 2011 according to metadata; current administrative changes may be missing.
- Risk thresholds are prototype assumptions, not official warnings.
- Open-Meteo free/public API usage and OSM tile policies may constrain deployment; check current terms before production use.
