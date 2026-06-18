# v0.dev prompt — ParkSight (Next.js + shadcn/ui, multi-page, interactive)

> Attach to the same v0 message: `DESIGN_SPEC.md` and `app/sample_api_responses.json`.
> Then paste the prompt below. v0 is built on shadcn/ui, so it will produce exactly that look in
> working React code.

---

## PROMPT

Build **ParkSight**, a multi-page **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** web app
for Bengaluru Traffic Police to find illegal-parking congestion hotspots and optimize patrol
deployment. Use the **shadcn/ui** component library throughout — start from the shadcn **dashboard-01**
and **sidebar-07** blocks. Use **recharts** (shadcn charts) for charts and **react-leaflet** with a free
dark CARTO basemap for the map (no Mapbox token). Follow the attached `DESIGN_SPEC.md` exactly.

**Look:** shadcn dark theme — neutral near-black bg, `zinc` greys, 1px hairline borders, rounded-xl
cards, Inter font, generous spacing. **One accent: amber `#F5A623`** (primary buttons, active nav, the
"optimized" chart series, key metrics). No gradients, glassmorphism, neon, drop-shadow depth, emoji, or
marketing sections — clean and typographic like the shadcn examples.

**App shell:** a persistent left **shadcn Sidebar** (wordmark "ParkSight" + amber dot) with TWO nav
routes: **Command Center · Analytics** (active route highlighted amber). Slim top bar with the page
title + a "Bengaluru · Nov 2023–Apr 2024" label. Real routing between the 2 pages.

**Pages (only 2 — use tabs for depth, don't sprawl):**

1. **/command (Command Center)** — the hero page:
   - Top: 4 **KPI cards** (612 Hotspots · 1,15,350 Violations · 22 Recommended patrols · 77% Achievable
     coverage).
   - Main split: LEFT (~65%) a large **react-leaflet** dark map of Bengaluru with ~600 hotspot circle
     markers (size ∝ `violations`, color ∝ `cii`, yellow→orange→red) PLUS, after optimizing, amber
     **numbered patrol markers** and faint translucent **coverage circles**. RIGHT rail: a **Patrol
     Optimizer** card — **Slider** "Patrol units" (15), **Slider** "Coverage radius" (1000m), a huge
     amber **coverage-%** number, two Badges "Even spread" / "Volume-only"; below it compact **Filters**
     (Select violation type, Select police station).
   - Below the map: a **shadcn Tabs** panel — **"Coverage curve"** (recharts line: amber Optimized vs
     dim dashed Volume + Even, vertical dashed marker at the elbow "Recommended fleet") and
     **"Deployment plan"** (sortable Table: Rank, Station, Road class·lanes, Covered, Shift, Impact % +
     amber Download CSV).

2. **/analytics** — a single page of **shadcn Tabs**: **Temporal** (7×24 heatmap, IST, with the
   "evenings = enforcement gap" caption), **Violations** (bar), **Vehicles** (bar), **Stations**
   (ranked bar).

**Data / API:** all data comes from a REST API. Base URL behind
`process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`. For now use the attached
`sample_api_responses.json` as mock data so it renders, but structure every call as a function (I will
drop in a real client `lib/api.ts`):
- `GET /api/stats` · `GET /api/hotspots?limit=&violation=&station=` · `POST /api/optimize {num_patrols, cover_radius_m}`
  · `GET /api/coverage-curve?kmax=` · `GET /api/temporal` · `GET /api/breakdown`

**Interactivity:** sidebar route switching; the two sliders call `/api/optimize` (debounced) and update
the coverage %, badges, map overlay, and table live; filter Selects refetch the map; sortable table;
tabbed analytics; hover tooltips on charts + map markers.

**DO NOT build:** login/auth, signup, landing/marketing page, pricing, settings, onboarding, chatbot,
notifications, theme toggle. Keep strictly to the 2 routes above (use tabs for depth), shadcn components
only, one amber accent.

---

## Follow-up messages (one tweak per turn)
- "Wire all data through `lib/api.ts` (pasting it now) and read the base URL from NEXT_PUBLIC_API_URL."
- "On the optimizer, debounce the sliders and update the map overlay + coverage % + table on change."
- "On the coverage chart, draw a vertical dashed amber line at the `elbow` labeled 'Recommended fleet'."
- "Make the map markers' size scale with `violations` and color with `cii` (yellow→orange→red)."
- "Tighten spacing to match the shadcn dashboard example; remove any shadows/gradients."
