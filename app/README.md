# ParkSight API (backend)

FastAPI backend for the parking-congestion **Enforcement Command Center**. Serves hotspot data,
temporal/breakdown analytics, and the live patrol-deployment optimizer. The frontend is built
separately (see `../DESIGN_SPEC.md`) and consumes these JSON endpoints.

## Run
```bash
pip install -r requirements.txt

# 1) one-time: enrich hotspots with road geometry (needs the cached OSM graph). Already run;
#    regenerate only if hotspot_summary.csv changes:
python precompute.py

# 2) start the API (from the app/ folder):
uvicorn main:app --reload --port 8000
```
Interactive docs (OpenAPI): http://localhost:8000/docs

## Architecture
- **Offline (`precompute.py`)**: snaps the 612 hotspots to OSM roads → `lanes` + `road_class` →
  `impact = CII × (1/lanes × class_weight)`. Writes `data/hotspots_enriched.csv`. Heavy (loads the
  road graph) but runs once.
- **Runtime (`main.py` + `core.py` + `data.py`)**: loads the enriched CSV, builds a coverage
  BallTree once, runs greedy max-coverage **per request** (sub-second). No osmnx needed to serve.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/api/stats` | header KPIs + recommended fleet size |
| GET | `/api/hotspots?limit=&min_cii=&violation=&station=` | hotspots for map/table (filterable) |
| GET | `/api/hotspots/{id}` | single hotspot detail |
| POST | `/api/optimize` `{num_patrols, cover_radius_m}` | optimized patrol plan + coverage vs baselines |
| GET | `/api/coverage-curve?kmax=&cover_radius_m=` | coverage-vs-fleet curve + elbow |
| GET | `/api/temporal` | day×hour heatmap (IST) + peak hours |
| GET | `/api/breakdown` | violation / vehicle distributions |

## Files
- `main.py` — FastAPI app + endpoints
- `core.py` — coverage index + greedy max-coverage optimizer (pure)
- `data.py` — data loading, stats/temporal/breakdown (cached)
- `schemas.py` — Pydantic models / API contract
- `precompute.py` — offline road-grounding step
- `data/hotspots_enriched.csv` — precomputed input the API serves from
