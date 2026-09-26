# MausamMitra

**Smart Forecasts for a Safer India**

MausamMitra is intended to be an India-focused weather intelligence system that combines numerical weather prediction (NWP) sources with transparent verification, adaptive weighting, forecast blending, risk indicators, and map-based exploration. This repository is at its initial setup stage: it currently contains source weather API code and India administrative boundary data. Frontend and backend application implementations, database migrations, and automated tests have not yet been added.

## Architecture

The target data flow follows the project specification:

```text
React + Vite + TypeScript -> FastAPI -> provider adapters and PostgreSQL/Supabase
                                      -> normalization, verification, weighting,
                                         blending, and risk calculations
```

The frontend must call the FastAPI service and must never connect directly to PostgreSQL. Provider credentials and database secrets belong only in the backend environment.

## Technology stack

Planned stack from the MausamMitra MVP specification:

- Frontend: React, Vite, TypeScript, Tailwind CSS, React Router, Axios, React-Leaflet, and Recharts
- Backend: Python, FastAPI, httpx, Pandas, NumPy, scikit-learn, and Pydantic
- Database: PostgreSQL through Supabase
- Forecast sources: NCEP GFS, ECMWF IFS HRES, ECMWF AIFS, and GFS ensemble/ensemble mean, subject to endpoint and access availability
- Map: Leaflet with OSM-compatible tiles and the supplied administrative GeoJSON

These are target choices, not a claim that the application layers are already implemented.

## Repository layout

```text
.
├── backend/                 # FastAPI application (planned)
├── data/geojson/india/      # Supplied boundaries and source metadata
├── docs/                    # Data source and project documentation
├── frontend/                # React application (planned)
├── tests/                   # Automated tests (planned)
├── .env.example             # Variable names only; no credentials
├── .gitignore
└── README.md
```

## Environment variables

Copy `.env.example` to a local environment file and fill only the values needed for your setup. Never commit `.env` files. The template intentionally contains variable names without credentials. `SUPABASE_SERVICE_ROLE_KEY`, database passwords, and provider credentials must remain server-side and must never use a `VITE_` or other public frontend prefix.

Current template names include `BACKEND_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `ECMWF_API_KEY`, provider base URLs, and `OSM_TILE_URL`. Confirm the names against application configuration as code is added.

## Setup and running

There is no runnable frontend or backend yet. The following commands describe the intended setup once those applications are implemented; exact scripts and dependencies will be documented with the relevant package files.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload
```

### Database

Configure a Supabase project or PostgreSQL instance through backend-only environment variables. No database schema or migrations exist in this initial setup. Add and document migrations before relying on persistent application data.

## API documentation

The target service is a FastAPI API under `/api`; the MVP specification calls for forecast, model metrics/comparison, historical analysis, and risk configuration endpoints. No API routes exist yet. When implemented, FastAPI's generated OpenAPI documentation should be available at `/docs` during local development.

## Weather providers and blending

The supplied `weather api code.txt` is a standalone Open-Meteo Python example that requests multiple model series, including GFS and ECMWF model identifiers. It is exploratory source material, not an integrated provider adapter. Provider availability, data licensing, endpoint access, and forecast-run compatibility must be confirmed before presenting a model as operational.

The planned blending method uses inverse-error model weights based on historical verification, with 70% MAE and 30% RMSE contributions, normalized to sum to one. If verification data is insufficient, the backend should report its fallback weighting explicitly. Wind direction must be blended with wind-vector components rather than a direct arithmetic average. No blending engine currently exists.

## Risk thresholds

The MVP specification calls for backend-configurable prototype thresholds for rainfall, wind, and heat. It explicitly treats the initial values as assumptions, not official IMD warnings. Store threshold configuration on the backend and surface that disclaimer in the UI. No risk engine or threshold configuration currently exists.

## Map data and usage requirements

Supplied boundary files and their upstream metadata are kept under [`data/geojson/india`](data/geojson/india). The metadata describes ADM0 and ADM1 data as OpenStreetMap sourced and ODbL licensed, with Wambacher's OSM boundaries site listed as a secondary source. ADM2 metadata names Datameet Group of India and labels the license “Creative Commons 2.0”; its source link points to Datameet's district maps project. That label does not identify the exact CC license version/conditions, so verify the upstream terms before redistribution or production use. Preserve attribution and comply with the applicable share-alike/attribution obligations. The GeoJSON `metadata.json` files are retained beside the data to preserve provenance.

The project target is React-Leaflet with an OSM-compatible tile provider. Configure the tile URL, show required attribution, and follow the selected provider's usage policy. Do not bulk-download, scrape, or aggressively prefetch public OSM tiles.

## Tests

No tests are present yet. The target test tools are pytest with FastAPI TestClient for the backend and Vitest with React Testing Library for the frontend. Once implemented, use:

```powershell
cd backend; py -m pytest
cd frontend; npm test
```

Do not treat these commands as passing until the corresponding suites have been added and run.

## Known limitations

- This commit establishes repository hygiene and documentation only; it is not the complete forecast MVP.
- No frontend, API service, database schema, provider adapters, blending, risk engine, or automated tests are implemented yet.
- The existing API example uses Open-Meteo and is not evidence that all specified model products are available or scientifically comparable through one endpoint.
- The ADM2 metadata's broad “Creative Commons 2.0” wording needs upstream license verification.
- Administrative boundaries may be dated or contain upstream geometry/label limitations; check the source before operational use.
