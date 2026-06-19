## ParkSight — Traffic Management (Phase 1)

Building the Overview and Hotspot Map pages first with mocked data and a stylized SVG map (no Google Maps yet). Patrol Optimizer and Analytics will be stubbed nav items for now.

### Design direction
Custom dark "command center" aesthetic — distinct from the uploaded green/light reference.

**Palette (from your spec)**
- Navy Slate `#0F172A` — sidebar/header
- Deep Canvas `#1E293B` — app background
- Surface Panel `#334155` — cards
- Dividers `#475569`
- Command Blue `#1D4ED8` — primary actions, active nav
- Critical `#EF4444`, Warning `#F59E0B`, Active `#10B981`, Info `#06B6D4`
- Text primary `#F8FAFC`, secondary `#94A3B8`

**Typography** — Space Grotesk (headings, slightly technical) + Inter (body). Tabular numerals for KPI numbers. Big stat figures (~56px) in light weight to feel instrument-panel-like, not generic SaaS card.

**Visual signature (to avoid generic look)**
- Thin 1px dividers in `#475569` instead of pillowy cards with heavy borders
- KPI "instruments": label as small uppercase tracked caption, huge number, micro-sparkline underneath
- Subtle scanline/grid texture overlay on map panel
- Status chips as outlined pill with colored dot, not filled badges
- Sidebar uses left accent bar on active item (Command Blue) — no filled pill

### Pages

**1. Overview (`/`)**
- Left sidebar: brand "ParkSight", nav (Overview active, Hotspot Map, Patrol Optimizer, Analytics)
- Top bar: region selector "Bengaluru · Urban Core", date range "Nov 2023 – Apr 2024", user chip
- Hero row: 4 KPI instruments — Hotspots (612), Violations analyzed (1,15,350), Recommended fleet (22), Achievable coverage (77% with thin progress bar)
- Headline insight banner: "5 patrols cover ~48% of violations" with mini sparkline
- Mini map preview (SVG heatmap) on left + Top-5 hotspots list on right (rank, area name, violation count, trend arrow)
- Quick links row to other pages

**2. Hotspot Map (`/hotspot-map`)**
- Full-bleed SVG map panel (stylized city grid + radial heat blobs in amber/red, dot clusters in cyan)
- Floating filter card top-left: checkboxes for layers (Hotspots, Hexbin congestion, Blind Spots, Violations)
- Floating legend bottom-right with intensity scale
- Right-side detail drawer (collapsible): selected cluster info — ID, violations count, peak hours bar, top streets list
- Date range + region pinned to top bar (shared)

**3 & 4. Patrol Optimizer / Analytics** — route files exist with "Coming next" placeholder so nav works.

### Technical notes
- Tailwind v4 tokens in `src/styles.css` (`@theme` with semantic color names: `--color-canvas`, `--color-panel`, `--color-divider`, `--color-command`, `--color-critical`, `--color-warning`, `--color-active`, `--color-info`). Never hardcode hex in components.
- Fonts via `@fontsource/space-grotesk` + `@fontsource/inter`, imported in entry.
- Routes: `src/routes/index.tsx` (Overview), `src/routes/hotspot-map.tsx`, `src/routes/patrol-optimizer.tsx`, `src/routes/analytics.tsx`, plus a shared `_layout` via `__root.tsx` rendering the sidebar + topbar shell.
- Map = handcrafted SVG (grid streets + radial-gradient heat circles + scattered dots). No external map deps.
- All data mocked in `src/data/mock.ts`.
- Per-route `head()` with unique title/description.

### Out of scope (phase 1)
Real maps, backend, auth, CSV export, route computation, charts library — Patrol Optimizer + Analytics get stub pages only.
