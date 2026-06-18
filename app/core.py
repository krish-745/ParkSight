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
