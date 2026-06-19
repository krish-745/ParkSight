"""
Enforcement Command Center — optimize WHERE to deploy limited patrols for maximum
parking-congestion relief.

Pipeline:
  1. Ground each hotspot's impact in REAL road geometry (OpenStreetMap): a blockage on a
     2-lane road kills ~50% of capacity, on a 6-lane arterial ~17% — weighted by road class.
     => capacity_loss impact per hotspot (physically meaningful, not arbitrary points).
  2. Maximum-coverage optimization: a patrol stationed at a location covers every hotspot
     within COVER_RADIUS. Greedy submodular selection (provably near-optimal) picks the K
     stations that cover the most total capacity-loss. Overlap matters -> real optimization.
  3. Prove it: compare optimized vs "spread evenly (random)" vs "chase raw volume".
  4. Diminishing-returns curve over K -> recommend the optimal fleet size (the elbow).

Outputs: optimized_deployment.csv, coverage_curve.png, printed summary.
Run:  python Flipkart_Round2/enforcement_optimizer.py
"""

import glob, os, warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.neighbors import BallTree

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)               # repo root
OUTPUT_DIR = os.path.join(ROOT, "output")
GRAPH_PATH = os.path.join(ROOT, "data", "blr_graph.graphml")
EARTH_M = 6371000.0
COVER_RADIUS_M = 1000     # one patrol's effective coverage radius
KMAX = 40                 # max fleet size to chart

# Road-class importance (throughput weight) and typical lane defaults when OSM lacks 'lanes'
CLASS_WEIGHT = {"motorway": 3.0, "trunk": 3.0, "primary": 2.5, "secondary": 2.0,
                "tertiary": 1.5, "unclassified": 1.2, "residential": 1.0,
                "living_street": 0.8, "service": 0.8}
CLASS_LANES = {"motorway": 3, "trunk": 3, "primary": 2, "secondary": 2,
               "tertiary": 1, "unclassified": 1, "residential": 1,
               "living_street": 1, "service": 1}


def _first(x):
    """OSM tags can be a list; take the first/typical value."""
    if isinstance(x, list):
        return x[0] if x else None
    return x


def add_capacity_loss(hs):
    """Weight each hotspot's impact by real road geometry (lanes + class) from OSM.
    Falls back gracefully to the raw CII if the road graph is unavailable."""
    try:
        import osmnx as ox
        if os.path.exists(GRAPH_PATH):
            G = ox.load_graphml(GRAPH_PATH)
        else:
            print("  road graph not cached; downloading (one-time)...")
            G = ox.graph_from_bbox(bbox=(77.30, 12.80, 77.80, 13.30), network_type="drive")
            os.makedirs(os.path.dirname(GRAPH_PATH), exist_ok=True)
            ox.save_graphml(G, GRAPH_PATH)
        edges = ox.distance.nearest_edges(G, X=hs.centroid_lon.values, Y=hs.centroid_lat.values)
        cls, lanes = [], []
        for e in edges:                      # osmnx returns an array/list of (u, v, k)
            a, b, c = e
            d = G.edges[a, b, c]
            hw = _first(d.get("highway", "residential"))
            cls.append(hw if hw in CLASS_WEIGHT else "residential")
            ln = _first(d.get("lanes"))
            try:
                ln = int(float(ln))
            except (TypeError, ValueError):
                ln = CLASS_LANES.get(cls[-1], 1)
            lanes.append(max(1, ln))
        hs = hs.copy()
        hs["road_class"] = cls
        hs["lanes"] = lanes
        hs["class_weight"] = hs.road_class.map(CLASS_WEIGHT).fillna(1.0)
        # blocked fraction of carriageway when a lane is occupied, x road throughput weight
        hs["capacity_loss_factor"] = (1.0 / hs.lanes) * hs.class_weight
        print(f"  snapped {len(hs)} hotspots to OSM roads "
              f"(lanes/class grounded; {hs.road_class.value_counts().head(3).to_dict()})")
    except Exception as e:
        print(f"  [warn] OSM grounding unavailable ({e}); using raw CII without road weighting")
        hs = hs.copy()
        hs["capacity_loss_factor"] = 1.0
    # final impact = congestion index x how badly a blockage there hurts the carriageway
    hs["impact"] = hs["congestion_impact_index"] * hs["capacity_loss_factor"]
    return hs


def coverage_matrix(hs):
    """Boolean-ish: which hotspots each candidate location covers (within radius)."""
    coords = np.radians(hs[["centroid_lat", "centroid_lon"]].values)
    tree = BallTree(coords, metric="haversine")
    nbrs = tree.query_radius(coords, r=COVER_RADIUS_M / EARTH_M)  # candidate i covers these
    return nbrs


def greedy_maxcover(hs, nbrs, K):
    """Greedy submodular max-coverage: pick K stations maximizing covered impact."""
    impact = hs["impact"].values
    covered = np.zeros(len(hs), dtype=bool)
    chosen, curve = [], []
    for _ in range(K):
        best_i, best_gain, best_new = -1, -1, None
        for i in range(len(hs)):
            if i in chosen:
                continue
            new = nbrs[i][~covered[nbrs[i]]]
            gain = impact[new].sum()
            if gain > best_gain:
                best_i, best_gain, best_new = i, gain, new
        if best_i < 0 or best_gain <= 0:
            break
        chosen.append(best_i)
        covered[best_new] = True
        curve.append(impact[covered].sum())
    return chosen, np.array(curve)


def baseline_curve(hs, nbrs, K, mode, seed=0):
    """Coverage achieved by a non-optimized strategy, for comparison."""
    impact = hs["impact"].values
    if mode == "volume":                      # chase raw violation count, ignore overlap
        order = hs["violation_count"].values.argsort()[::-1]
    else:                                      # 'even' = random spread (avg of a few seeds)
        rng = np.random.default_rng(seed)
        order = rng.permutation(len(hs))
    covered = np.zeros(len(hs), dtype=bool)
    curve = []
    for i in order[:K]:
        covered[nbrs[i]] = True
        curve.append(impact[covered].sum())
    return np.array(curve)


def shift_window(hour):
    if 6 <= hour < 12:
        return "Morning (06:00-12:00)"
    if 12 <= hour < 17:
        return "Afternoon (12:00-17:00)"
    if 17 <= hour < 22:
        return "Evening (17:00-22:00)"
    return "Night (22:00-06:00)"


def main():
    hs = pd.read_csv(os.path.join(OUTPUT_DIR, "hotspot_summary.csv"))
    print(f"Loaded {len(hs)} hotspots. Grounding impact in road geometry (OSM)...")
    hs = add_capacity_loss(hs)
    total = hs["impact"].sum()
    nbrs = coverage_matrix(hs)

    chosen, opt_curve = greedy_maxcover(hs, nbrs, KMAX)
    even = np.mean([baseline_curve(hs, nbrs, KMAX, "even", s) for s in range(5)], axis=0)
    vol = baseline_curve(hs, nbrs, KMAX, "volume")

    opt_pct = opt_curve / total * 100
    print("\n=== COVERAGE (% of total parking-congestion impact) ===")
    for k in (5, 10, 15, 20, 30):
        if k <= len(opt_pct):
            print(f"  {k:>2} patrols: OPTIMIZED {opt_pct[k-1]:5.1f}%   |   "
                  f"even-spread {even[k-1]/total*100:5.1f}%   |   volume-chase {vol[k-1]/total*100:5.1f}%")

    # elbow = where marginal gain drops below 1% of total
    marg = np.diff(np.concatenate([[0], opt_curve])) / total * 100
    elbow = int(np.argmax(marg < 1.0)) if np.any(marg < 1.0) else len(marg)
    print(f"\nRecommended fleet size (elbow, marginal gain <1%): ~{elbow} patrols "
          f"-> covers {opt_pct[max(elbow-1,0)]:.1f}% of impact")

    # deployment plan for the elbow-sized fleet
    plan_k = max(elbow, 10)
    rows = []
    covered = np.zeros(len(hs), dtype=bool)
    for rank, i in enumerate(chosen[:plan_k], 1):
        cov = nbrs[i]
        r = hs.iloc[i]
        rows.append({
            "patrol_rank": rank,
            "station": r["dominant_police_station"],
            "lat": round(r["centroid_lat"], 5), "lon": round(r["centroid_lon"], 5),
            "road_class": r.get("road_class", "n/a"), "lanes": r.get("lanes", "n/a"),
            "hotspots_covered": int(len(cov)),
            "recommended_shift": shift_window(int(r["peak_hour"])),
            "impact_covered_pct": round(hs.iloc[cov]["impact"].sum() / total * 100, 2),
        })
    plan = pd.DataFrame(rows)
    out = os.path.join(OUTPUT_DIR, "optimized_deployment.csv")
    plan.to_csv(out, index=False)
    print(f"\n=== OPTIMIZED DEPLOYMENT PLAN ({plan_k} patrols) ===")
    print(plan.to_string(index=False))
    print(f"\nSaved -> {out}")

    # coverage curve plot
    ks = np.arange(1, len(opt_curve) + 1)
    plt.figure(figsize=(10, 6))
    plt.plot(ks, opt_pct, "o-", color="#1f77b4", lw=2, label="Optimized (max-coverage)")
    plt.plot(ks, vol[:len(ks)] / total * 100, "s--", color="#ff7f0e", label="Chase raw volume")
    plt.plot(ks, even[:len(ks)] / total * 100, "^--", color="#888", label="Spread evenly")
    plt.axvline(elbow, color="red", ls=":", label=f"Recommended fleet = {elbow}")
    plt.xlabel("Number of patrol units deployed")
    plt.ylabel("% of city parking-congestion impact covered")
    plt.title("Enforcement Coverage vs Fleet Size\n(a few well-placed units cover most impact)")
    plt.legend(); plt.grid(alpha=0.3); plt.tight_layout()
    p = os.path.join(OUTPUT_DIR, "coverage_curve.png")
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"Saved -> {p}")


if __name__ == "__main__":
    main()
