# Frontend Kit — step-by-step runbook

Everything except the visual design is done for you. Follow these steps in order.

## What's in this kit
- `lib/api.ts` — typed API client (all endpoints). Drop into the v0 project.
- `.env.local.example` — the one env var the frontend needs.
- `V0_PROMPT.md` — the exact message + attachments to give v0.

You also have (one folder up): `../DESIGN_SPEC.md` and `../app/sample_api_responses.json` — both are
attachments for v0.

---

## STEP 1 — Start the backend (do this first, keep it running)
```bash
cd Flipkart_Round2/app
pip install -r requirements.txt        # first time only
uvicorn main:app --reload --port 8000
```
Verify: open http://localhost:8000/docs — you should see all endpoints. Leave this terminal running.

## STEP 2 — Design the UI in Google Stitch
1. Go to https://stitch.withgoogle.com and sign in. Choose **Web** + **Experimental/Gemini** mode.
2. **Paste** the prompt from `STITCH_PROMPT.md` (it's self-contained — Stitch doesn't take file
   attachments, so the design system + real numbers are baked into the prompt).
3. Generate, then refine one tweak per message using the follow-up lines in `STITCH_PROMPT.md`.

> Stitch makes a **design**, not a running app. It mocks the map as a styled panel and uses the
> embedded sample numbers — that's expected. The live map + real data come in STEP 4.

## STEP 3 — Export from Stitch
- **"Copy to Figma"** if a teammate will build the React app from the design, OR
- **Export the code** (HTML/CSS/Tailwind) to use as the visual base.

## STEP 4 — Turn the design into a live app (integration)
Stitch output is static markup, so it needs wiring to become interactive (real react-leaflet map +
live API). Two ways:
- **Easiest:** hand the exported code (or a screenshot + the code) to your dev — or paste it back to
  Claude — to scaffold a small React/Next app, drop in `frontend_kit/lib/api.ts`, and wire the
  endpoints. This is integration work, not design.
- **Manual:** in a Next.js project, recreate the layout from the Stitch design, copy
  `frontend_kit/lib/api.ts` into `lib/`, copy `.env.local.example` → `.env.local`, then fetch:
  ```ts
  import { api } from "@/lib/api";
  const stats = await api.stats();
  const hotspots = await api.hotspots({ limit: 600 });
  const result = await api.optimize({ num_patrols: 15, cover_radius_m: 1000 });
  const curve = await api.coverageCurve({ kmax: 40 });
  ```

## STEP 5 — Run both together
```bash
npm run dev            # frontend on http://localhost:3000
# backend already running on :8000 from STEP 1
```
Open http://localhost:3000. CORS is already enabled on the backend, so the calls just work.

## STEP 6 (optional) — Deploy
Deploy the frontend (Vercel/Netlify). The backend must also be reachable — keep it local with a local
frontend for the demo, or host the API and set `NEXT_PUBLIC_API_URL` to that URL.

---

## Troubleshooting
- **Blank map / map errors:** make sure v0 used `react-leaflet` (no Mapbox token). If it used Mapbox,
  tell it: *"switch the map to react-leaflet with a free CARTO dark basemap, no token."*
- **CORS error in browser console:** confirm the backend is running on :8000; CORS is already open in
  `main.py`. If you changed the port, update `.env.local`.
- **Empty data:** hit the endpoint directly (e.g. http://localhost:8000/api/stats) to confirm the
  backend works, then check the frontend is using `NEXT_PUBLIC_API_URL`.
- **`optimize` slow on first call:** it isn't — it's sub-second. If the whole app is slow to start,
  that's the backend's first data load (a second or two), not the optimizer.
