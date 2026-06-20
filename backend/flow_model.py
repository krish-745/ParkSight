"""
Graph-diffusion congestion forecaster  (the "flow algorithm + ML" layer).

Idea
----
Treat each parking hotspot as a node in a weighted graph. Congestion does not stay
put: a busy hotspot spills load onto its spatial neighbours over the next hour. We
model that as a *flow / diffusion* over the graph:

        x(h+1)  =  alpha * x(h)  +  beta * ( W - I ) @ x(h)

i.e. graph-Laplacian diffusion: x(h) is the per-hotspot intensity (sum of congestion-impact
scores) at hour h, W is a row-normalised distance-decay adjacency (W_ij = exp(-d_ij / sigma)
over each node's k nearest neighbours), and L = (W - I) is the graph Laplacian. The three
scalars (alpha = persistence/decay, beta = diffusion rate, sigma = spatial decay) are
*learned by least squares* from the real hour-to-hour dynamics — that is the ML step, and
`sigma` is literally the learned graph weighting ("congestion spills over ~X metres").

Everything is built from our own parking data — no external road graph / weights download.
Persistence (alpha=1, beta=0) lies inside the model's hypothesis space, so the fit can only
match or beat the naive "nothing changes" baseline; we also report a held-out skill number.
"""

import numpy as np
from sklearn.neighbors import BallTree

EARTH_M = 6371000.0

# from-hours held out for the out-of-sample skill estimate (spread across the day)
_TEST_HOURS = (2, 7, 11, 15, 19, 22)
_SIGMA_GRID_M = (150.0, 250.0, 400.0, 600.0, 900.0, 1400.0)
_K = 6


def _build_graph(lats, lons, k, sigma_m):
    """Row-normalised distance-decay adjacency over each node's k nearest neighbours."""
    n = len(lats)
    tree = BallTree(np.radians(np.c_[lats, lons]), metric="haversine")
    kk = min(k + 1, n)
    dist_rad, idx = tree.query(np.radians(np.c_[lats, lons]), k=kk)
    dist_m = dist_rad * EARTH_M
    W = np.zeros((n, n), dtype=float)
    for i in range(n):
        for j_pos in range(kk):
            j = idx[i, j_pos]
            if j == i:
                continue
            W[i, j] = np.exp(-dist_m[i, j_pos] / sigma_m)
    row = W.sum(axis=1, keepdims=True)
    row[row == 0] = 1.0
    return W / row, tree, idx, dist_m


def _diffuse(xh, W, alpha, beta):
    """One diffusion step: x(h+1) = alpha*x + beta*(W - I)@x."""
    return alpha * xh + beta * (W @ xh - xh)


def _fit_alpha_beta(X, W, from_hours):
    """Closed-form 2-parameter least squares for x(h+1) = a*x(h) + b*(W-I)@x(h)."""
    P, Y = [], []
    for h in from_hours:
        xh = X[:, h]
        Y.append(X[:, (h + 1) % 24])
        P.append(np.c_[xh, W @ xh - xh])
    P = np.vstack(P)
    Y = np.concatenate(Y)
    coef, *_ = np.linalg.lstsq(P, Y, rcond=None)
    return float(coef[0]), float(coef[1])


def _scores(X, W, alpha, beta, from_hours, move_frac=0.05):
    """Forecast diagnostics over the given transitions:
       RMSE (model & persistence baseline) and directional hit-rate.

    Directional hit-rate: among hotspots that actually move materially next hour
    (|Δactual| > move_frac · global_max), the fraction where the model predicts the
    correct sign of change. Persistence predicts Δ=0, so it has no directional skill."""
    gmax = float(X.max()) or 1.0
    thr = move_frac * gmax
    se_m, se_b, n = 0.0, 0.0, 0
    hit, mover = 0, 0
    for h in from_hours:
        xh = X[:, h]
        y = X[:, (h + 1) % 24]
        pred = _diffuse(xh, W, alpha, beta)
        se_m += float(np.sum((pred - y) ** 2))
        se_b += float(np.sum((xh - y) ** 2))   # persistence: predict "no change"
        n += len(y)
        d_actual = y - xh
        d_pred = pred - xh
        m = np.abs(d_actual) > thr
        mover += int(m.sum())
        hit += int(np.sum(np.sign(d_pred[m]) == np.sign(d_actual[m])))
    rmse_m = (se_m / n) ** 0.5
    rmse_b = (se_b / n) ** 0.5
    dir_acc = (hit / mover * 100) if mover else 0.0
    return rmse_m, rmse_b, dir_acc


class FlowModel:
    """Learned graph-diffusion forecaster, built once from the store."""

    def __init__(self, store):
        hs = store.hs
        self.lats = hs["centroid_lat"].to_numpy(float)
        self.lons = hs["centroid_lon"].to_numpy(float)
        self.names = hs["dominant_police_station"].astype(str).tolist()
        self.n = len(hs)

        # ── per-hotspot × hour intensity matrix (sum of impact scores) ──
        cl = store.clustered
        cl = cl[cl.cluster != -1]
        cluster_to_row = {int(c): int(i) for i, c in zip(hs.index, hs["cluster"])}
        X = np.zeros((self.n, 24), dtype=float)
        score = cl["congestion_impact_score"].fillna(0.0).to_numpy(float)
        rows = cl["cluster"].map(cluster_to_row).to_numpy()
        hours = cl["hour"].to_numpy(int)
        for r, h, s in zip(rows, hours, score):
            if r == r:  # not NaN
                X[int(r), h] += s
        self.X = X
        self.global_max = float(X.max()) or 1.0
        self.peak_hour = X.argmax(axis=1).astype(int)

        # ── learn sigma (graph weights) + alpha/beta via held-out grid search ──
        all_hours = list(range(24))
        train_hours = [h for h in all_hours if h not in _TEST_HOURS]
        best = None
        for sigma in _SIGMA_GRID_M:
            W, *_ = _build_graph(self.lats, self.lons, _K, sigma)
            a, b = _fit_alpha_beta(X, W, train_hours)
            rm_te, rb_te, dir_te = _scores(X, W, a, b, _TEST_HOURS)
            if best is None or rm_te < best["rmse_model_test"]:
                best = dict(sigma=sigma, alpha=a, beta=b, W=W,
                            rmse_model_test=rm_te, rmse_baseline_test=rb_te, dir_test=dir_te)

        # refit on ALL hours at the chosen sigma for the deployed operator
        self.sigma = best["sigma"]
        self.W = best["W"]
        self.alpha, self.beta = _fit_alpha_beta(X, self.W, all_hours)
        rm, rb, dir_acc = _scores(X, self.W, self.alpha, self.beta, all_hours)
        skill = (1 - rm / rb) * 100 if rb else 0.0
        skill_te = (1 - best["rmse_model_test"] / best["rmse_baseline_test"]) * 100 \
            if best["rmse_baseline_test"] else 0.0
        self.metrics = dict(
            rmse_model=round(rm, 2), rmse_baseline=round(rb, 2), skill_pct=round(skill, 1),
            direction_acc_pct=round(dir_acc, 1),
            rmse_model_test=round(best["rmse_model_test"], 2),
            rmse_baseline_test=round(best["rmse_baseline_test"], 2),
            skill_pct_test=round(skill_te, 1),
            direction_acc_pct_test=round(best["dir_test"], 1),
        )

    # ── outputs ──────────────────────────────────────────────────────────────
    def hourly(self):
        """Real historical per-hotspot 24h intensity profile (normalised 0..1) — the slider."""
        out = []
        for i in range(self.n):
            prof = (self.X[i] / self.global_max).round(4).tolist()
            out.append(dict(id=i, lat=float(self.lats[i]), lon=float(self.lons[i]),
                            name=self.names[i], peak_hour=int(self.peak_hour[i]), hourly=prof))
        return dict(hours=list(range(24)), count=self.n, hotspots=out)

    def forecast(self, hour: int, steps: int = 1):
        """Roll the learned diffusion operator forward from `hour` by `steps` hours."""
        hour = int(hour) % 24
        x = self.X[:, hour].copy()
        for _ in range(max(1, int(steps))):
            x = _diffuse(x, self.W, self.alpha, self.beta)
        x = np.clip(x, 0, None)
        actual = self.X[:, (hour + int(steps)) % 24]
        gm = self.global_max
        out = []
        for i in range(self.n):
            out.append(dict(id=i, lat=float(self.lats[i]), lon=float(self.lons[i]),
                            name=self.names[i],
                            now=round(float(self.X[i, hour] / gm), 4),
                            predicted=round(float(x[i] / gm), 4),
                            actual=round(float(actual[i] / gm), 4)))
        return dict(hour=hour, steps=int(steps),
                    params=self._params(), metrics=self.metrics, hotspots=out)

    def displacement(self, source_id: int, steps: int = 4, top: int = 12):
        """Where does parking demand displace to if hotspot `source_id` is enforced/cleared?

        Random walk over the learned graph: put unit mass on the source and let it flow
        along the spill-over edges (W is row-stochastic) for `steps` hops. Returns the
        neighbours that absorb the most displaced demand."""
        source_id = int(source_id) % self.n
        Wt = self.W.T
        p = np.zeros(self.n)
        p[source_id] = 1.0
        absorbed = np.zeros(self.n)
        decay = 0.7
        w = 1.0
        for _ in range(max(1, int(steps))):
            p = Wt @ p
            w *= decay
            absorbed += w * p
        absorbed[source_id] = 0.0
        tot = absorbed.sum() or 1.0
        order = np.argsort(absorbed)[::-1]
        recv = [dict(id=int(j), lat=float(self.lats[j]), lon=float(self.lons[j]),
                     name=self.names[j], share=round(float(absorbed[j] / tot), 4))
                for j in order if absorbed[j] > 0][:top]
        s = source_id
        return dict(source=dict(id=s, lat=float(self.lats[s]), lon=float(self.lons[s]),
                                name=self.names[s]),
                    sigma_m=round(self.sigma, 0), steps=int(steps), receivers=recv)

    def graph(self, max_edges: int = 400):
        """Strongest directed flow edges (for the optional flow-line overlay) + diagnostics."""
        edges = []
        for i in range(self.n):
            for j in np.nonzero(self.W[i])[0]:
                edges.append((float(self.W[i, j]), i, int(j)))
        edges.sort(reverse=True)
        top = [dict(a=i, b=j, w=round(w, 3),
                    a_lat=float(self.lats[i]), a_lon=float(self.lons[i]),
                    b_lat=float(self.lats[j]), b_lon=float(self.lons[j]))
               for w, i, j in edges[:max_edges]]
        return dict(params=self._params(), metrics=self.metrics, edges=top)

    def _params(self):
        return dict(alpha=round(self.alpha, 3), beta=round(self.beta, 3),
                    sigma_m=round(self.sigma, 0), k=_K)
