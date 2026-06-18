# ParkSight — Frontend Design Spec (for the designer / design tool)

> This document defines **exactly** what to build. The backend already exists (FastAPI).
> Build **only** what's described here. **Do not invent extra pages, features, or data.**
> See the "OUT OF SCOPE" section — anything there must NOT appear.

---

## 1. What the product is (one sentence)
A multi-page **operations web app** for Bengaluru Traffic Police that shows illegal-parking
**congestion hotspots** and lets an officer get an **AI-optimized patrol deployment plan** —
"with N patrols, cover X% of the city's parking-congestion impact."

Audience: traffic-police command staff. Tone: a serious **control-room / command-center** tool built in
the **shadcn/ui** design language (think the shadcn dashboard example), **not** a consumer app. Dense,
data-first, dark.

---

## 2. App shell + 2 routes (real navigation)

Persistent **shadcn Sidebar** (left): wordmark "ParkSight" + amber dot, two nav items —
**Command Center · Analytics** (active = amber). Slim top bar = page title + "Bengaluru ·
Nov 2023–Apr 2024". Content swaps per route. Sidebar collapses on narrow screens. **Only 2 pages —
use tabs for depth, don't add more routes.**

---

## 3. Pages & components (build these, and only these)

### 3.1 `/command` — Command Center (the hero page)
- Top: 4 **KPI cards** from `GET /api/stats`: Hotspots `total_hotspots` · Violations
  `total_violations` · Recommended fleet `recommended_fleet` · Achievable coverage
  `coverage_at_recommended_pct`%.
- **Main split** — LEFT (~65%): a large **react-leaflet** dark map (CARTO dark, center 12.97/77.59,
  zoom 11). Hotspot markers from `GET /api/hotspots`: circle markers, **size ∝ violations**, **color ∝
  cii** (`cii_normalized` 0–100, yellow→orange→red). Click → shadcn detail card (station,
  dominant_violation, dominant_vehicle, violations, peak_hour→shift, road_class·lanes). After optimizing,
  overlay amber **numbered patrol markers** + translucent **coverage circles** (radius = `cover_radius_m`).
- **Main split** — RIGHT rail: a **Patrol Optimizer** card (`POST /api/optimize`): **Slider** "Patrol
  units" 1–40 (default 15), **Slider** "Coverage radius" 200–3000m step 100 (default 1000); big amber
  **`total_coverage_pct`**; two Badges "Even spread `baseline_even_pct`%" / "Volume-only
  `baseline_volume_pct`%" (debounce slider → refetch + update map overlay + tabs below). Under it,
  compact **Filters**: Select violation type (→ `violation=`), Select station (→ `station=`).
- **Below the map** — a **shadcn Tabs** panel with two tabs:
  - **Coverage curve** (`GET /api/coverage-curve`): recharts line, x=`k`, `optimized_pct` (amber),
    `volume_pct` + `even_pct` (dim dashed), vertical dashed marker at `elbow` "Recommended fleet".
  - **Deployment plan**: sortable shadcn Table from the optimize `plan` (Rank, Station, Road
    `road_class`·`lanes`, Covered `hotspots_covered`, Shift `recommended_shift`, Impact
    `impact_covered_pct`%) + amber **Download CSV** button.

### 3.2 `/analytics`
A single page of **shadcn Tabs**:
- **Temporal** — 7×24 heatmap from `GET /api/temporal` (`matrix`, `days`, `hours`), color = count;
  caption uses `evening_share_pct`: "Evenings (5–9 PM) = {x}% → enforcement gap."
- **Violations** / **Vehicles** — horizontal bar charts from `GET /api/breakdown`.
- **Stations** — ranked bar of `stats.top_stations`.

---

## 4. Data source = the API (do not hardcode/fake data)
Base URL configurable (default `http://localhost:8000`). Endpoints:

| Endpoint | Use |
|---|---|
| `GET /api/stats` | header KPI cards |
| `GET /api/hotspots?limit=&min_cii=&violation=&station=` | map markers + filters |
| `GET /api/hotspots/{id}` | marker detail (optional) |
| `POST /api/optimize` `{num_patrols, cover_radius_m}` | optimizer → map overlay + plan table + coverage numbers |
| `GET /api/coverage-curve?kmax=&cover_radius_m=` | coverage curve chart |
| `GET /api/temporal` | temporal heatmap |
| `GET /api/breakdown` | (optional) violation/vehicle bar charts if space allows |

Full schemas live at `http://localhost:8000/docs` (OpenAPI). Match field names exactly.

---

## 5. Visual design system (follow exactly — goal: looks like a real product, not an AI demo)
Aesthetic target: the calm precision of **Linear / Vercel-Geist / Stripe dashboard**. Restrained,
typographic, lots of negative space, ONE accent.

**Tokens:**
- App bg `#0B0C0E`; cards/panels `#141619`; borders 1px hairline `#262A30` (elevation = border +
  lighter surface, **never drop shadows**).
- Text: primary `#E6E8EB`, muted `#9BA1A8`, dim `#6B7178`.
- **One accent `#F5A623` (amber)** for optimized/primary only; optional muted teal `#3FB6A8` for a
  2nd chart series. Map heat scale only: `#FCD34D → #F97316 → #DC2626`.
- Radius 12px (cards) / 8px (controls); 8px spacing grid; generous padding.
- Type: Geist/Inter; big numbers `tabular-nums`, bold, tight tracking; labels small, UPPERCASE, muted.

**Rules:** KPI cards = number + tiny label (no icons/gradients). Charts = no bg, faint horizontal
gridlines only, accent for optimized line, dim/dashed baselines. Map = CARTO dark-matter, small clean
markers, ~10% coverage-circle fill. Tables = dense, hairline dividers, right-aligned tabular numerics.
Motion subtle (150–200ms). Map is the focal point; numbers feel big and confident.

**Banned (these scream "AI-generated"):** gradients, glassmorphism/blur, neon glows, drop-shadow
depth, multiple accent colors, emoji, blobby over-rounded cards, hero/marketing sections, decorative
non-data icons.

---

## 6. OUT OF SCOPE — do NOT build any of this
- ❌ Login / signup / auth / user profiles / roles
- ❌ Settings pages, onboarding, tutorials, modals beyond the hotspot detail popup
- ❌ Landing/marketing page, hero sections, testimonials, pricing, footer links
- ❌ Routes/pages beyond the 2 listed in §3 (Command Center, Analytics) — use tabs, not more routes
- ❌ Chatbot / AI assistant widget
- ❌ Fake/placeholder data, fake charts, or metrics not listed in §3
- ❌ Notifications, dark/light toggle, language switcher
- ❌ Editing/CRUD of hotspots; this is read-only + the optimizer
- ❌ Real-time/websocket anything

Keep it to: **the shadcn sidebar shell + the 2 routes in §3 (with internal tabs).** Nothing else.
