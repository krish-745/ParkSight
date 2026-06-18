# ParkSight — Features to Add (ranked best → worst)

Ranking weighs **idea strength × implementation feasibility × demo impact × defensibility**
(the last one matters — judges poke holes; everything here is grounded in data/assets we actually have).
Effort assumes the existing FastAPI backend + OSM road graph + optimizer are already in place.

## Priority table

| # | Feature | Idea | Effort | Demo wow | Defensible? | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Patrol Route Optimizer (TSP)** | High | Low | ★★★★★ | Yes (geometry) | **Build first** |
| 2 | **Enforcement Blind Spots** | Very high | Med | ★★★★ | Yes (our bias finding) | **Build** |
| 3 | **Predictive / Proactive Hotspots** | High | Med | ★★★★ | Yes (seasonal, validated) | **Build if time** |
| 4 | **Fine-Revenue & Relief Estimator** | Med-high | Low | ★★★★ | With stated assumptions | Strong add |
| 5 | **Repeat-Offender Intelligence** | Med-high | Low | ★★★ | Yes (vehicle_number) | Nice differentiator |
| 6 | **Camera / ANPR Placement Mode** | Med | Low | ★★★ | Yes (reuses optimizer) | Optional 2nd lever |
| 7 | **AI Natural-Language Briefing** | Med | Med | ★★★ | Risky (gimmick) | Only if polished |
| 8 | **Displacement Simulation** | High idea | High | ★★★ | Weak (unvalidated) | Last / talk-only |

---

## 1. Patrol Route Optimizer (TSP)  — build first
**What:** Beyond *where* to deploy, compute the actual **driving circuit** connecting the chosen patrol
stations on the real road network → draw the route on the map with total distance + ETA.
**Why it wins:** Turns "12 dots" into "here's the 18 km, ~45 min patrol loop" — the single most visual,
operations-ready moment in the demo.
**Implementation:** reuse the cached OSM graph; nearest-neighbor + 2-opt over the optimized station
coords; `networkx.shortest_path` for each leg; sum `travel_time`. New endpoint `GET/POST /api/route`
returning ordered stops + polyline coords + km + minutes. **Effort: ~1–2 hrs.**
**Caveat:** none material — it's deterministic routing on real geometry.

## 2. Enforcement Blind Spots  — build
**What:** Surface zones with **high predicted impact but LOW current enforcement** — the spots being
missed today.
**Why it wins:** Weaponizes the bias we found (violations are logged where police already patrol). Tells
judges something counterintuitive and shows rigor — "we find where enforcement *should* be, not just
where it *is*." Genuinely novel and honest.
**Implementation:** per zone, compare impact rank vs an enforcement-activity proxy (action-rate /
relative volume); flag high-impact + low-activity cells. New endpoint `/api/blindspots`; a map layer +
a small list. **Effort: ~half day.**
**Caveat:** frame as "relative under-coverage," not absolute proof.

## 3. Predictive / Proactive Hotspots  — build if time
**What:** Forecast tomorrow / next-Saturday violation pressure per zone → pre-position patrols *before*
the jam.
**Why it wins:** Directly answers the PS's "enforcement is reactive" pain point — shifts the whole tool
from hindsight to next-shift planning.
**Implementation:** we already validated seasonal predictability (R²~0.6, time-split) — a small seasonal
model (zone × day-of-week × month × festival) or even seasonal averages; `/api/forecast?date=`.
**Effort: ~half day.**
**Caveat:** present honestly as **seasonal forecasting** (a simple baseline matches ML) — don't oversell
as deep AI.

## 4. Fine-Revenue & Relief Estimator
**What:** Attach a tangible payoff to a deployment plan: "addresses ~X% of carriageway-blocking
violations and ≈ ₹Y / month recoverable fines."
**Why it wins:** A money number + concrete relief figure lands hard with judges and policy reviewers.
**Implementation:** violations in covered zones × per-violation fine (state the assumption) + the
capacity-loss already computed. A KPI card / panel on the optimizer page. **Effort: ~1 hr.**
**Caveat:** fine amounts are assumptions — show them openly and let them be edited.

## 5. Repeat-Offender Intelligence
**What:** Use the (anonymized) `vehicle_number` to find chronic offenders: "the top 200 repeat vehicles
account for X% of violations" → targeted notices instead of blanket patrols.
**Why it wins:** A different axis (vehicle-level, not just spatial) — shows the data has more depth.
**Implementation:** `groupby vehicle_number` → counts, top offenders, repeat-rate; `/api/offenders`.
A small table/stat. **Effort: ~1 hr.**
**Caveat:** anonymized IDs, so privacy-safe; note repeats may partly reflect patrol patterns.

## 6. Camera / ANPR Placement Mode
**What:** A toggle to optimize **fixed camera** locations (permanent infrastructure) instead of mobile
patrols — facility-location on the most persistent hotspots.
**Why it wins:** A second, policy-relevant lever (capex vs. opex enforcement).
**Implementation:** reuse the max-coverage optimizer but rank by **persistence** (`n_active_days`)
rather than peak-hour; a mode switch on the optimizer. **Effort: ~1–2 hrs.**
**Caveat:** somewhat overlaps the existing optimizer — incremental, not headline.

## 7. AI Natural-Language Briefing
**What:** An auto-generated "today's enforcement briefing" paragraph from the live stats
("Priorities: Upparpet (morning), Shivajinagar… evenings under-covered…").
**Why it wins:** A genuine "AI-driven" touch; reads like a real ops brief.
**Implementation:** one Claude API call summarizing `/api/stats` + top zones into 3–4 sentences;
cache it. **Effort: ~half day incl. key handling.**
**Caveat:** can feel gimmicky and adds an external dependency/cost — only include if it's crisp and
clearly grounded in the numbers, not fluffy.

## 8. Displacement Simulation  — last / talk-about-only
**What:** Model that enforcing hotspot A pushes violators to nearby B (spatial displacement) and show
the residual.
**Why it wins (idea):** Sophisticated, real-world criminology insight — sounds impressive.
**Why it's last (implementation):** we have **no data to validate** displacement; any numbers would be
invented — exactly the trap we've avoided all along. **Effort: high, payoff fragile.**
**Recommendation:** mention it verbally as "future work / with longitudinal data," don't build a fake
simulation.

---

## Suggested plan
- **Must:** #1 Patrol Route (visual win) + #2 Blind Spots (smart + honest) → together they tell a
  complete story: *find the right zones incl. the ones you're missing → route patrols through them.*
- **If time:** #3 Forecast (proactive) and/or #4 Revenue (tangible payoff).
- Keep #8 as a talking point only.
