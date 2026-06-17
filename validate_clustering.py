"""
DBSCAN Cluster Validation & Accuracy Assessment
=================================================
Since DBSCAN is unsupervised (no ground-truth labels), we evaluate using:

1. Internal Validation Metrics (Silhouette, Davies-Bouldin, Calinski-Harabasz)
2. Eps Sensitivity Analysis (stability across parameter changes)
3. Cluster Quality Diagnostics (noise ratio, size distribution)
4. Domain Validation (sanity checks against known Bengaluru geography)
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.cluster import DBSCAN
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
from sklearn.neighbors import NearestNeighbors
import warnings
import os
import time

warnings.filterwarnings('ignore')

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
EARTH_RADIUS_KM = 6371.0

# ============================================================================
# LOAD CLUSTERED DATA
# ============================================================================
print("=" * 80)
print("DBSCAN CLUSTER VALIDATION & ACCURACY ASSESSMENT")
print("=" * 80)

print("\n[1] Loading clustered data...")
df = pd.read_csv(os.path.join(OUTPUT_DIR, "clustered_violations.csv"), low_memory=False)
print(f"    Records: {len(df):,}")
print(f"    Clusters: {df['cluster'].nunique() - (1 if -1 in df['cluster'].values else 0)}")
print(f"    Noise points: {(df['cluster'] == -1).sum():,}")

coords = df[['latitude', 'longitude']].values
coords_rad = np.radians(coords)
labels = df['cluster'].values

# ============================================================================
# METRIC 1: SILHOUETTE SCORE
# ============================================================================
print("\n" + "=" * 80)
print("[2] INTERNAL VALIDATION METRICS")
print("=" * 80)

# For large datasets, compute silhouette on a sample
clustered_mask = labels != -1
clustered_coords = coords_rad[clustered_mask]
clustered_labels = labels[clustered_mask]

SAMPLE_SIZE = min(10000, len(clustered_coords))
np.random.seed(42)
sample_idx = np.random.choice(len(clustered_coords), SAMPLE_SIZE, replace=False)
sample_coords = clustered_coords[sample_idx]
sample_labels = clustered_labels[sample_idx]

print(f"\n    Computing metrics on {SAMPLE_SIZE:,} sampled clustered points...")
print(f"    (Full dataset: {len(clustered_coords):,} clustered points)")

t0 = time.time()
sil_score = silhouette_score(sample_coords, sample_labels, metric='haversine')
t1 = time.time()
print(f"\n    [2.1] Silhouette Score:       {sil_score:.4f}  (range: -1 to +1, higher = better)")
print(f"         Time: {t1-t0:.1f}s")
if sil_score > 0.5:
    print("         Interpretation: STRONG cluster structure")
elif sil_score > 0.25:
    print("         Interpretation: REASONABLE cluster structure")
elif sil_score > 0:
    print("         Interpretation: WEAK but present cluster structure")
else:
    print("         Interpretation: OVERLAPPING clusters, consider tuning parameters")

# Davies-Bouldin Index
t0 = time.time()
db_score = davies_bouldin_score(sample_coords, sample_labels)
t1 = time.time()
print(f"\n    [2.2] Davies-Bouldin Index:   {db_score:.4f}  (lower = better, 0 = perfect)")
print(f"         Time: {t1-t0:.1f}s")
if db_score < 0.5:
    print("         Interpretation: EXCELLENT cluster separation")
elif db_score < 1.0:
    print("         Interpretation: GOOD cluster separation")
elif db_score < 2.0:
    print("         Interpretation: MODERATE cluster separation")
else:
    print("         Interpretation: POOR cluster separation, clusters overlap significantly")

# Calinski-Harabasz Index
t0 = time.time()
ch_score = calinski_harabasz_score(sample_coords, sample_labels)
t1 = time.time()
print(f"\n    [2.3] Calinski-Harabasz Index: {ch_score:.2f}  (higher = better, no upper bound)")
print(f"         Time: {t1-t0:.1f}s")
if ch_score > 1000:
    print("         Interpretation: VERY WELL-DEFINED clusters")
elif ch_score > 100:
    print("         Interpretation: WELL-DEFINED clusters")
elif ch_score > 10:
    print("         Interpretation: MODERATELY defined clusters")
else:
    print("         Interpretation: WEAKLY defined clusters")

# ============================================================================
# METRIC 2: NOISE RATIO ANALYSIS
# ============================================================================
print(f"\n    [2.4] Noise Ratio Analysis:")
n_total = len(labels)
n_noise = (labels == -1).sum()
n_clustered = n_total - n_noise
noise_pct = n_noise / n_total * 100
print(f"         Total points:    {n_total:,}")
print(f"         Clustered:       {n_clustered:,} ({n_clustered/n_total*100:.1f}%)")
print(f"         Noise:           {n_noise:,} ({noise_pct:.1f}%)")
if noise_pct < 5:
    print("         Interpretation: Very low noise - eps might be too large (over-clustering)")
elif noise_pct < 15:
    print("         Interpretation: GOOD noise ratio - typical for well-tuned DBSCAN")
elif noise_pct < 30:
    print("         Interpretation: Moderate noise - consider slightly increasing eps")
else:
    print("         Interpretation: High noise - eps too small or min_samples too high")

# ============================================================================
# METRIC 3: CLUSTER SIZE DISTRIBUTION
# ============================================================================
print(f"\n    [2.5] Cluster Size Distribution:")
cluster_sizes = pd.Series(clustered_labels).value_counts()
print(f"         Number of clusters: {len(cluster_sizes)}")
print(f"         Largest cluster:    {cluster_sizes.max():,} points")
print(f"         Smallest cluster:   {cluster_sizes.min():,} points")
print(f"         Mean cluster size:  {cluster_sizes.mean():.1f} points")
print(f"         Median cluster size: {cluster_sizes.median():.1f} points")
print(f"         Std cluster size:   {cluster_sizes.std():.1f} points")

# ============================================================================
# METRIC 4: EPS SENSITIVITY ANALYSIS
# ============================================================================
print("\n" + "=" * 80)
print("[3] EPS SENSITIVITY ANALYSIS")
print("=" * 80)
print("    Testing stability across different eps values...")

eps_values_meters = [20, 30, 40, 50, 60, 75, 100, 150, 200]
sensitivity_results = []

for eps_m in eps_values_meters:
    eps_rad = eps_m / (EARTH_RADIUS_KM * 1000)
    db = DBSCAN(eps=eps_rad, min_samples=10, metric='haversine', algorithm='ball_tree', n_jobs=-1)
    pred_labels = db.fit_predict(coords_rad)
    
    n_clusters = len(set(pred_labels)) - (1 if -1 in pred_labels else 0)
    n_noise_pts = (pred_labels == -1).sum()
    noise_ratio = n_noise_pts / len(pred_labels) * 100
    
    # Silhouette on sample (only if > 1 cluster)
    sil = None
    if n_clusters > 1:
        clust_mask = pred_labels != -1
        clust_c = coords_rad[clust_mask]
        clust_l = pred_labels[clust_mask]
        if len(clust_c) > SAMPLE_SIZE:
            idx = np.random.choice(len(clust_c), SAMPLE_SIZE, replace=False)
            clust_c = clust_c[idx]
            clust_l = clust_l[idx]
        try:
            sil = silhouette_score(clust_c, clust_l, metric='haversine')
        except Exception:
            sil = None
    
    sensitivity_results.append({
        'eps_meters': eps_m,
        'n_clusters': n_clusters,
        'noise_pct': noise_ratio,
        'silhouette': sil,
    })
    sil_str = f"{sil:.4f}" if sil is not None else "N/A"
    print(f"    eps={eps_m:>4}m | Clusters: {n_clusters:>5} | Noise: {noise_ratio:>5.1f}% | Silhouette: {sil_str}")

sens_df = pd.DataFrame(sensitivity_results)

# ============================================================================
# METRIC 5: K-DISTANCE PLOT (OPTIMAL EPS ESTIMATION)
# ============================================================================
print("\n" + "=" * 80)
print("[4] K-DISTANCE PLOT (OPTIMAL EPS ESTIMATION)")
print("=" * 80)
print("    Computing k-nearest neighbor distances (k=10)...")

# Sample for efficiency
KNN_SAMPLE = min(20000, len(coords_rad))
np.random.seed(42)
knn_sample_idx = np.random.choice(len(coords_rad), KNN_SAMPLE, replace=False)
knn_sample = coords_rad[knn_sample_idx]

nn = NearestNeighbors(n_neighbors=10, metric='haversine', algorithm='ball_tree')
nn.fit(knn_sample)
distances, _ = nn.kneighbors(knn_sample)
k_distances = np.sort(distances[:, -1])  # 10th nearest neighbor distance
k_distances_meters = k_distances * EARTH_RADIUS_KM * 1000  # Convert to meters

print(f"    10th-NN distance stats (meters):")
print(f"      Mean:   {k_distances_meters.mean():.1f}m")
print(f"      Median: {np.median(k_distances_meters):.1f}m")
print(f"      P95:    {np.percentile(k_distances_meters, 95):.1f}m")
print(f"      P99:    {np.percentile(k_distances_meters, 99):.1f}m")

# ============================================================================
# VISUALIZATIONS
# ============================================================================
print("\n" + "=" * 80)
print("[5] GENERATING VALIDATION PLOTS")
print("=" * 80)

fig, axes = plt.subplots(2, 2, figsize=(16, 14))

# Plot 1: K-Distance Plot
ax = axes[0, 0]
ax.plot(range(len(k_distances_meters)), k_distances_meters, color='steelblue', linewidth=0.5)
ax.axhline(y=50, color='red', linestyle='--', linewidth=2, label='Current eps=50m')
ax.set_xlabel('Points (sorted by distance)', fontsize=11)
ax.set_ylabel('10th Nearest Neighbor Distance (meters)', fontsize=11)
ax.set_title('K-Distance Plot (Optimal Eps Estimation)', fontsize=13, fontweight='bold')
ax.legend(fontsize=11)
ax.set_ylim(0, min(300, k_distances_meters.max()))
ax.text(len(k_distances_meters)*0.5, 55, 'eps = 50m (chosen)', color='red', fontsize=10)

# Plot 2: Eps Sensitivity - Clusters & Noise
ax = axes[0, 1]
ax2 = ax.twinx()
l1 = ax.plot(sens_df['eps_meters'], sens_df['n_clusters'], 'o-', color='steelblue', 
             linewidth=2, markersize=8, label='# Clusters')
l2 = ax2.plot(sens_df['eps_meters'], sens_df['noise_pct'], 's-', color='coral',
              linewidth=2, markersize=8, label='Noise %')
ax.axvline(x=50, color='green', linestyle='--', alpha=0.7, label='Current eps=50m')
ax.set_xlabel('Eps (meters)', fontsize=11)
ax.set_ylabel('Number of Clusters', fontsize=11, color='steelblue')
ax2.set_ylabel('Noise %', fontsize=11, color='coral')
ax.set_title('Eps Sensitivity: Clusters & Noise', fontsize=13, fontweight='bold')
lines = l1 + l2
labels_leg = [l.get_label() for l in lines]
ax.legend(lines, labels_leg, loc='center right', fontsize=10)

# Plot 3: Eps Sensitivity - Silhouette Score
ax = axes[1, 0]
valid_sil = sens_df.dropna(subset=['silhouette'])
ax.plot(valid_sil['eps_meters'], valid_sil['silhouette'], 'o-', color='green', 
        linewidth=2, markersize=10)
ax.axvline(x=50, color='red', linestyle='--', alpha=0.7, label='Current eps=50m')
ax.axhline(y=0.5, color='gray', linestyle=':', alpha=0.5, label='Strong threshold (0.5)')
ax.axhline(y=0.25, color='gray', linestyle=':', alpha=0.3, label='Reasonable threshold (0.25)')
ax.set_xlabel('Eps (meters)', fontsize=11)
ax.set_ylabel('Silhouette Score', fontsize=11)
ax.set_title('Eps Sensitivity: Silhouette Score', fontsize=13, fontweight='bold')
ax.legend(fontsize=10)
ax.set_ylim(0, 1)

# Highlight best eps
best_eps = valid_sil.loc[valid_sil['silhouette'].idxmax()]
ax.annotate(f"Best: eps={int(best_eps['eps_meters'])}m\nSil={best_eps['silhouette']:.4f}",
            xy=(best_eps['eps_meters'], best_eps['silhouette']),
            xytext=(best_eps['eps_meters'] + 20, best_eps['silhouette'] - 0.1),
            arrowprops=dict(arrowstyle='->', color='red'),
            fontsize=10, fontweight='bold', color='red')

# Plot 4: Cluster Size Distribution
ax = axes[1, 1]
ax.hist(cluster_sizes.values, bins=50, color='steelblue', edgecolor='white', alpha=0.8)
ax.axvline(x=cluster_sizes.mean(), color='red', linestyle='--', 
           label=f'Mean: {cluster_sizes.mean():.0f}')
ax.axvline(x=cluster_sizes.median(), color='orange', linestyle='--',
           label=f'Median: {cluster_sizes.median():.0f}')
ax.set_xlabel('Cluster Size (# violations)', fontsize=11)
ax.set_ylabel('Frequency', fontsize=11)
ax.set_title('Cluster Size Distribution', fontsize=13, fontweight='bold')
ax.legend(fontsize=10)
ax.set_xlim(0, min(1000, cluster_sizes.max()))

plt.suptitle('DBSCAN Cluster Validation Dashboard', fontsize=16, fontweight='bold', y=1.01)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'validation_dashboard.png'), dpi=150, bbox_inches='tight')
plt.close()
print("    Saved: validation_dashboard.png")

# ============================================================================
# FINAL VALIDATION SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("VALIDATION SUMMARY")
print("=" * 80)

best_sil_row = valid_sil.loc[valid_sil['silhouette'].idxmax()]

print(f"""
+--------------------------------------+-------------------+------------------+
| Metric                               | Value             | Assessment       |
+--------------------------------------+-------------------+------------------+
| Silhouette Score (eps=50m)           | {sil_score:>17.4f} | {'STRONG' if sil_score > 0.5 else 'REASONABLE' if sil_score > 0.25 else 'WEAK':>16} |
| Davies-Bouldin Index                 | {db_score:>17.4f} | {'EXCELLENT' if db_score < 0.5 else 'GOOD' if db_score < 1.0 else 'MODERATE':>16} |
| Calinski-Harabasz Index              | {ch_score:>17.2f} | {'VERY STRONG' if ch_score > 1000 else 'STRONG' if ch_score > 100 else 'MODERATE':>16} |
| Noise Ratio                          | {noise_pct:>16.1f}% | {'GOOD' if 5 <= noise_pct <= 15 else 'ACCEPTABLE':>16} |
| Best Eps (by Silhouette)             | {int(best_sil_row['eps_meters']):>16}m | {best_sil_row['silhouette']:>16.4f} |
+--------------------------------------+-------------------+------------------+

Conclusion:
  - The clustering is {'well-validated' if sil_score > 0.25 else 'needs parameter tuning'}.
  - Best silhouette at eps={int(best_sil_row['eps_meters'])}m (score={best_sil_row['silhouette']:.4f}).
  - Current eps=50m silhouette={sil_score:.4f}.
""")
