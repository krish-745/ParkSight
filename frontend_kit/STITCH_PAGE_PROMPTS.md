# Stitch — 4 page prompts (one dark theme, no extra features)

## How to keep it consistent
1. Do all 4 in **ONE Stitch chat/project** (Web + Experimental mode).
2. Generate in this order: **Hotspot Map → Analytics → Overview → Optimizer** (the two dark
   references first, so the theme is set; then the adapted ones say "same theme as previous screens").
3. Attach the matching reference image to each prompt **for LAYOUT only** — every prompt forces OUR
   dark theme, so the two light references get adapted, not copied.
4. Paste the GLOBAL RULES block at the top of **every** prompt.

---

## GLOBAL RULES (prepend to every page prompt)
> This is one screen of **ParkSight**, a 4-page desktop web app for Bengaluru Traffic Police
> (illegal-parking congestion enforcement). **Match the premium dark NAVY + TEAL aesthetic of the
> attached reference** (deep navy background, teal accents, soft glows) — use the attached image for
> BOTH layout AND visual style. Apply this SAME navy/teal theme on every page so all four match.
> Palette: background deep navy `#0A0E1A` (with a subtle radial glow, like the reference); cards
> `#111A2E` with soft elevation; 1px hairline borders `#1E2A44`; text `#E6EAF2`, muted `#8B95AD`;
> **primary accent teal/mint `#2DD4BF`**, secondary indigo `#6366F1` used sparingly. Map & heatmap data
> use a low→high scale: teal `#2DD4BF` → amber `#F5A623` → red `#EF4444`. Inter font, rounded-xl cards,
> generous spacing. Subtle glows and soft depth are GOOD (match the reference); avoid garish multi-color
> gradients, glassmorphism overload, emoji, and marketing sections.
> Persistent left **sidebar** identical on every page: ParkSight (teal dot) + nav items
> **Overview · Hotspot Map · Patrol Optimizer · Analytics** (active item highlighted teal). Slim top bar
> = page title.
> **Do NOT add anything not listed for this page** — no login, settings, device logs, notifications,
> chatbot, search-everything, extra nav items, or invented widgets.

---

## PAGE 1 — Overview   (attach reference image #1, the traffic dashboard)
[GLOBAL RULES] Then:
> Build the **Overview** page. Use the attached layout (sidebar + content cards), dark theme.
> Content, and ONLY this:
> - A row of 4 **KPI cards**: "612" Hotspots · "1,15,350" Violations · "22" Recommended patrols · "77%" Achievable coverage.
> - One **insight card** (teal left-border): "5 optimally-placed patrols cover ~48% of the city's parking-congestion impact — vs 8% spread evenly."
> - A small **map preview** (dark, a dozen hotspot dots) linking to the Hotspot Map.
> - A **Top-5 hotspots** list: Upparpet, Shivajinagar, HAL Old Airport, Malleshwaram, Magadi Road (with violation counts).
> - A **Key Metrics** row: Clustered 93.1% · Noise 6.9% · Peak window 8–11 AM · Evening share 0.2%.
> Do NOT add device logs, settings, V2X/department status, or charts not listed.

## PAGE 2 — Hotspot Map   (attach reference image #2, the dark road-analysis heatmap)
[GLOBAL RULES] Then:
> Build the **Hotspot Map** page — match the attached dark map-analysis layout.
> - **Full-bleed dark map** of Bengaluru with glowing **hotspot density** (markers/heat: size = violations, color = impact on a low→high teal→amber→red scale).
> - A **filter panel** (top-left, translucent dark card): checkboxes/selects for Violation type and Police station, plus a "Hotspot heatmap" toggle.
> - A **stats overlay** (bottom-right card): top violation types as % bars — Wrong Parking, No Parking, Parking-in-Main-Road — and "Based on 115,350 violations".
> - Clicking a hotspot opens a small **detail popover**: station, violations, dominant violation, road class · lanes.
> Do NOT add camera feeds, device panels, or tools beyond zoom + the filter + stats panels.

## PAGE 3 — Patrol Optimizer   (attach reference image #3, the map + right control panel)
[GLOBAL RULES] Then:
> Build the **Patrol Optimizer** page — match the attached layout (map on the left, a control panel on the right), dark theme.
> - LEFT: dark Bengaluru map with hotspot dots PLUS teal **numbered patrol markers**, translucent teal **coverage circles**, and a thin **route line** connecting the patrols.
> - RIGHT control panel: a **slider** "Patrol units" (15), a **slider** "Coverage radius" (1000 m), a large teal **coverage %** with label "Congestion impact covered", two small chips "Even spread 20%" / "Volume-only 58%", and a **Compute Route** button showing total distance + ETA.
> - BELOW the map: a **Deployment Plan** table — Rank, Station, Road (class·lanes), Covered, Shift, Impact % — with a **Download CSV** button. Rows: 1 Upparpet·tertiary,2 ·14·Morning·18.0% / 2 Cubbon Park·unclassified,2 ·17·Morning·12.5% / 3 HAL Old Airport·primary,2 ·8·Night·7.7% / 4 Malleshwaram·secondary,2 ·8·Night·5.0% / 5 Magadi Road·secondary,2 ·13·Afternoon·4.7%.
> Do NOT add sensor inventory, device properties, battery status, or config tabs from the reference.

## PAGE 4 — Analytics   (attach reference image #4, the dark hex-heatmap + chart cards)
[GLOBAL RULES] Then:
> Build the **Analytics** page — match the attached dark heatmap + chart-cards layout.
> - A large **heatmap**: rows = Mon–Sun, columns = hours 0–23 (IST), cells colored by violation count
>   (warm in mornings 8–11, near-empty evenings). Caption: "Evenings (5–9 PM) = 0.2% → enforcement gap."
> - Below it, a row of **chart cards**: Violations by type (bar), Vehicles by type (bar), Top stations
>   (ranked bar). Optional shadcn **Tabs** to switch between them.
> Do NOT add trading/crypto widgets, terminals, wallets, or timeframe controls beyond a simple date label.

---

## After Stitch
Export each screen (Figma or code) and hand them to Claude (me) — I'll wire the real react-leaflet map
(hotspots + patrol markers + coverage circles + optional hexbin), the optimizer sliders, the route, the
heatmap, and all `/api/*` data into the design.
