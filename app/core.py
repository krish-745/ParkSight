"""
Core enforcement-optimization logic — pure numpy/sklearn, no heavy deps (osmnx not needed
at runtime; road-grounding is precomputed offline by precompute.py).

A patrol stationed at a hotspot covers every hotspot within `cover_radius_m`. We choose K
stations to maximize total covered IMPACT (road-capacity-weighted) using greedy max-coverage
(submodular -> within 1-1/e of optimum). Sub-second on ~600 hotspots, so it runs per request.
"""

from functools import lru_cache
import numpy as np
from sklearn.neighbors import BallTree

EARTH_M = 6371000.0


class CoverageIndex:
    """Precomputed neighbor lists for a set of hotspot coordinates, per radius."""

    def __init__(self, lats, lons):
        self.lats = np.asarray(lats, dtype=float)
        self.lons = np.asarray(lons, dtype=float)
        self._tree = BallTree(np.radians(np.c_[self.lats, self.lons]), metric="haversine")

    @lru_cache(maxsize=8)
    def neighbors(self, radius_m: int):
        rad = radius_m / EARTH_M
        coords = np.radians(np.c_[self.lats, self.lons])
        return self._tree.query_radius(coords, r=rad)  # array of index arrays


def greedy_maxcover(impact, nbrs, k):
    """Pick k stations maximizing covered impact. Returns (chosen_idx, coverage_curve)."""
    impact = np.asarray(impact, dtype=float)
    covered = np.zeros(len(impact), dtype=bool)
    chosen, curve = [], []
    chosen_set = set()
    for _ in range(int(k)):
        best_i, best_gain, best_new = -1, -1.0, None
        for i in range(len(impact)):
            if i in chosen_set:
                continue
            cov = nbrs[i]
            new = cov[~covered[cov]]
            gain = impact[new].sum()
            if gain > best_gain:
                best_i, best_gain, best_new = i, gain, new
        if best_i < 0 or best_gain <= 0:
            break
        chosen.append(best_i)
        chosen_set.add(best_i)
        covered[best_new] = True
        curve.append(float(impact[covered].sum()))
    return chosen, np.array(curve)


def baseline_curve(impact, nbrs, k, order):
    """Coverage achieved by a fixed (non-optimized) ordering of stations."""
    impact = np.asarray(impact, dtype=float)
    covered = np.zeros(len(impact), dtype=bool)
    curve = []
    for i in order[: int(k)]:
        covered[nbrs[i]] = True
        curve.append(float(impact[covered].sum()))
    return np.array(curve)


def even_order(n, seeds=(0, 1, 2, 3, 4)):
    """Average of several random permutations -> 'spread evenly' baseline."""
    return [np.random.default_rng(s).permutation(n) for s in seeds]


def elbow_k(curve, total, threshold_pct=1.0):
    """Smallest K where the marginal coverage gain drops below threshold_pct of total."""
    if len(curve) == 0:
        return 0
    marg = np.diff(np.concatenate([[0.0], curve])) / total * 100.0
    below = np.where(marg < threshold_pct)[0]
    return int(below[0]) if len(below) else len(curve)


def shift_window(hour: int) -> str:
    if 6 <= hour < 12:
        return "Morning (06:00-12:00)"
    if 12 <= hour < 17:
        return "Afternoon (12:00-17:00)"
    if 17 <= hour < 22:
        return "Evening (17:00-22:00)"
    return "Night (22:00-06:00)"


# ─────────────────────────────────────────────────────────────────────────────
# TSP Solver — nearest-neighbor construction + 2-opt improvement
# ─────────────────────────────────────────────────────────────────────────────

def haversine_matrix(lats, lons):
    """Pairwise great-circle distance matrix (km) for n points."""
    lats = np.radians(np.asarray(lats, dtype=float))
    lons = np.radians(np.asarray(lons, dtype=float))
    n = len(lats)
    # broadcast: dlat[i,j] = lats[j] - lats[i]
    dlat = lats[None, :] - lats[:, None]
    dlon = lons[None, :] - lons[:, None]
    a = np.sin(dlat / 2) ** 2 + np.cos(lats[:, None]) * np.cos(lats[None, :]) * np.sin(dlon / 2) ** 2
    return 2 * (EARTH_M / 1000) * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def nearest_neighbor_tsp(dist, start=0):
    """Greedy nearest-neighbor tour starting from `start`. Returns ordered indices."""
    n = len(dist)
    visited = {start}
    tour = [start]
    cur = start
    for _ in range(n - 1):
        row = dist[cur].copy()
        row[list(visited)] = np.inf
        nxt = int(np.argmin(row))
        tour.append(nxt)
        visited.add(nxt)
        cur = nxt
    return tour


def two_opt_improve(tour, dist, max_iters=2000):
    """2-opt local search: repeatedly reverse sub-tours to reduce total distance."""
    tour = list(tour)
    n = len(tour)
    if n < 4:
        return tour

    def tour_dist(t):
        return sum(dist[t[i], t[(i + 1) % n]] for i in range(n))

    best = tour_dist(tour)
    improved = True
    iters = 0
    while improved and iters < max_iters:
        improved = False
        iters += 1
        for i in range(n - 1):
            for j in range(i + 2, n):
                if i == 0 and j == n - 1:
                    continue  # skip full reversal
                # cost of removing edges (i, i+1) and (j, j+1) and adding (i, j) and (i+1, j+1)
                a, b = tour[i], tour[(i + 1) % n]
                c, d = tour[j], tour[(j + 1) % n]
                delta = (dist[a, c] + dist[b, d]) - (dist[a, b] + dist[c, d])
                if delta < -1e-10:
                    tour[i + 1:j + 1] = tour[i + 1:j + 1][::-1]
                    best += delta
                    improved = True
    return tour


def solve_tsp(lats, lons):
    """Full TSP pipeline: build distance matrix → NN construction → 2-opt improvement.
    Returns (ordered_indices, distance_matrix_km)."""
    dist = haversine_matrix(lats, lons)
    n = len(lats)
    if n <= 1:
        return list(range(n)), dist
    if n <= 3:
        return list(range(n)), dist

    # try starting from each node, keep best tour
    best_tour, best_cost = None, np.inf
    for start in range(min(n, 5)):  # try up to 5 starts for quality
        tour = nearest_neighbor_tsp(dist, start)
        tour = two_opt_improve(tour, dist)
        cost = sum(dist[tour[i], tour[(i + 1) % n]] for i in range(n))
        if cost < best_cost:
            best_tour, best_cost = tour, cost
    return best_tour, dist
