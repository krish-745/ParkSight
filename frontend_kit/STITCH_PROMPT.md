# Google Stitch prompt — ParkSight (shadcn/ui look, 2 screens)

> Same plan as the v0 prompt, for a side-by-side comparison.

## How to use
1. stitch.withgoogle.com → **Web** + **Experimental/Gemini** mode.
2. (Recommended) attach a **screenshot of https://ui.shadcn.com/** (dashboard or sidebar block, dark
   mode) as the style reference — plus `../DESIGN_SPEC.md` and `../app/sample_api_responses.json`.
3. Paste the prompt. Generate **screen 1**, then **screen 2** (Stitch designs one screen at a time).
4. Export → Figma or code. (Stitch mocks the map as a styled panel; the real map comes at integration.)

---

## PROMPT

Design **ParkSight**, a **2-page web app** (desktop) for Bengaluru Traffic Police to find illegal-parking
congestion hotspots and optimize patrol deployment. **Match the shadcn/ui design language**
(https://ui.shadcn.com) — the shadcn **dark dashboard** look: neutral near-black background, zinc greys,
1px hairline borders, rounded-xl cards, Inter font, generous spacing. **One accent: amber `#F5A623`**
(active nav, key numbers, the "optimized" series, primary button). No gradients, glassmorphism, neon,
drop shadows, emoji, or marketing sections — flat, clean, typographic like the shadcn examples.

**App shell (both screens):** a left **sidebar** (wordmark "ParkSight" + amber dot) with two nav items —
**Command Center** and **Analytics** (active one highlighted amber). A slim top bar: page title +
"Bengaluru · Nov 2023–Apr 2024".

### Screen 1 — Command Center (the hero)
- Top: a row of 4 **KPI cards** (big number + tiny uppercase label):
  "612" Hotspots · "1,15,350" Violations · "22" Recommended patrols · "77%" Achievable coverage.
- **Split body:**
  - LEFT (~65% width): a **dark map panel** of Bengaluru with ~40 scattered circular **hotspot dots**
    (varying size = violations; color on a yellow `#FCD34D` → orange `#F97316` → red `#DC2626` scale).
    A few amber **numbered patrol markers** with faint translucent amber **coverage circles**. Labels on
    the biggest dots: Upparpet, Shivajinagar, HAL Old Airport, Malleshwaram, Magadi Road.
  - RIGHT rail: a **Patrol Optimizer** card — a slider "Patrol units" (15), a slider "Coverage radius"
    (1000 m), then a very large amber **"68%"** with label "CONGESTION IMPACT COVERED", and two small
    chips "Even spread 20%" / "Volume-only 58%". Under it a compact **Filters** card (two dropdowns:
    Violation type, Police station).
- **Below the map:** a **tabbed panel** with two tabs:
  - "Coverage curve": a line chart rising and flattening (x = patrol units 0–40), amber line "Optimized",
    two dim dashed grey lines "Volume" and "Even", a vertical dashed marker at x=22 "Recommended fleet".
  - "Deployment plan": a dense table — Rank, Station, Road, Covered, Shift, Impact %. Rows:
    1 Upparpet · tertiary,2ln · 14 · Morning · 18.0% ; 2 Cubbon Park · unclassified,2ln · 17 · Morning ·
    12.5% ; 3 HAL Old Airport · primary,2ln · 8 · Night · 7.7% ; 4 Malleshwaram · secondary,2ln · 8 ·
    Night · 5.0% ; 5 Magadi Road · secondary,2ln · 13 · Afternoon · 4.7%. A "Download CSV" button.

### Screen 2 — Analytics
A single page of **tabs**: 
- "Temporal": a 7×24 heatmap (rows Mon–Sun, cols hours 0–23), warm amber cells concentrated in the
  morning 8–11 columns, near-empty evenings; caption "Evenings (5–9 PM) = 0.2% → enforcement gap."
- "Violations": horizontal bar chart — Wrong Parking 60,150 · No Parking 57,186 · Main Road 8,571 ·
  Footpath · Double Parking.
- "Vehicles": horizontal bar chart — Car 36,803 · Scooter · Motorcycle · Passenger Auto · LGV.
- "Stations": ranked bar — Upparpet, Shivajinagar, HAL Old Airport, Malleshwaram, Vijayanagara.

**Interactivity to show:** the two sidebar items switch pages; sliders update the big coverage % and the
map overlay; dropdown filters; tabbed panels; hover tooltips on charts and map dots.

**Do NOT include:** login, signup, landing/marketing, pricing, settings, onboarding, chatbot,
notifications. Only these 2 screens, shadcn look, one amber accent.
