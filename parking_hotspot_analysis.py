"""
DBSCAN-Based Parking Violation Hotspot Detection & Congestion Impact Quantification
====================================================================================
Uses spatial clustering (DBSCAN with haversine metric) on ~298K parking violation
records from Bengaluru to identify illegal parking hotspots and quantify their
impact on traffic flow for targeted enforcement prioritization.

Author: AI-Parking Intelligence System
Dataset: Bengaluru Police Parking Violations (Nov 2023 – May 2024)
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import seaborn as sns
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import MinMaxScaler
from collections import Counter
import json
import re
import warnings
import os

warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURATION
# ============================================================================
import glob as _glob
def _find_data():
    here = os.path.dirname(__file__)
    for d in (here, os.path.dirname(here)):  # this folder, then parent
        hits = _glob.glob(os.path.join(d, "jan to may police violation*.csv"))
        if hits:
            return hits[0]
    raise FileNotFoundError("parking violation CSV not found in Flipkart_Round2/ or its parent")
DATA_PATH = _find_data()
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# DBSCAN Parameters
EPS_METERS = 50          # Radius in meters — typical road segment influence zone
MIN_SAMPLES = 10         # Minimum violations to form a cluster
EARTH_RADIUS_KM = 6371.0 # Earth radius for haversine

# Violation Severity Weights (higher = more congestion impact)
VIOLATION_SEVERITY = {
    "PARKING IN A MAIN ROAD": 5,
    "DOUBLE PARKING": 3,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 3,
    "PARKING NEAR ROAD CROSSING": 3,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 3,
    "PARKING ON FOOTPATH": 2,
    "WRONG PARKING": 2,
    "NO PARKING": 2,
}
DEFAULT_SEVERITY = 1

# Vehicle Footprint Scores (proportional to road space occupied)
VEHICLE_FOOTPRINT = {
    "TANKER": 3, "BUS": 3, "TRUCK": 3, "LORRY": 3, "LGV": 3,
    "MAXI-CAB": 2, "CAR": 2, "JEEP": 2, "AMBULANCE": 2, "PASSENGER AUTO": 2,
    "MOTOR CYCLE": 1, "SCOOTER": 1, "E-RICKSHAW": 1, "CYCLE": 0.5,
}
DEFAULT_FOOTPRINT = 1

# Junction proximity multiplier (applied as 1 + JUNCTION_MULT * is_junction)
JUNCTION_MULT = 0.3

# ============================================================================
# PHASE 1: DATA LOADING & PREPROCESSING
# ============================================================================
print("=" * 80)
print("PHASE 1: DATA LOADING & PREPROCESSING")
print("=" * 80)

# Load data
print(f"\n[1.1] Loading dataset from: {DATA_PATH}")
df = pd.read_csv(DATA_PATH, low_memory=False)
print(f"      Raw records: {len(df):,}")
print(f"      Columns: {list(df.columns)}")

# Basic stats
print(f"\n[1.2] Initial Data Summary:")
print(f"      Date range: {df['created_datetime'].min()} -> {df['created_datetime'].max()}")
print(f"      Unique police stations: {df['police_station'].nunique()}")
print(f"      Unique junctions: {df['junction_name'].nunique()}")
print(f"      Validation status distribution:")
print(df['validation_status'].value_counts().to_string(header=False))

# --- Filter approved records ---
print(f"\n[1.3] Filtering to approved records only...")
df_approved = df[df['validation_status'] == 'approved'].copy()
print(f"      Approved records: {len(df_approved):,} ({len(df_approved)/len(df)*100:.1f}%)")

# --- Drop rows with missing lat/lon ---
df_clean = df_approved.dropna(subset=['latitude', 'longitude']).copy()
print(f"      After dropping missing coordinates: {len(df_clean):,}")

# --- Remove obvious coordinate outliers (Bengaluru bounding box) ---
LAT_MIN, LAT_MAX = 12.7, 13.2
LON_MIN, LON_MAX = 77.3, 77.9
df_clean = df_clean[
    (df_clean['latitude'].between(LAT_MIN, LAT_MAX)) &
    (df_clean['longitude'].between(LON_MIN, LON_MAX))
].copy()
print(f"      After geographic bounding box filter: {len(df_clean):,}")

# ============================================================================
# PHASE 1b: FEATURE ENGINEERING
# ============================================================================
print(f"\n[1.4] Feature Engineering...")

# --- Parse datetime ---
# Timestamps are UTC; convert to IST (Asia/Kolkata, UTC+5:30) BEFORE deriving hour/day,
# otherwise peak-hour analysis is shifted 5.5h (UTC 0-6 is actually IST morning rush).
df_clean['created_datetime'] = pd.to_datetime(df_clean['created_datetime'], errors='coerce', utc=True)
df_clean['created_ist'] = df_clean['created_datetime'].dt.tz_convert('Asia/Kolkata')
df_clean['hour'] = df_clean['created_ist'].dt.hour
df_clean['day_of_week'] = df_clean['created_ist'].dt.dayofweek  # 0=Mon, 6=Sun
df_clean['month'] = df_clean['created_ist'].dt.month
df_clean['day_name'] = df_clean['created_ist'].dt.day_name()

# --- Parse violation_type JSON array ---
def parse_violation_types(val):
    """Parse the violation_type field which contains JSON-like arrays."""
    if pd.isna(val):
        return []
    try:
        # Handle the escaped JSON format: ["WRONG PARKING","NO PARKING"]
        val_clean = val.strip()
        if val_clean.startswith('[') and val_clean.endswith(']'):
            # Remove outer brackets and split
            inner = val_clean[1:-1]
            # Split by comma, strip quotes
            violations = [v.strip().strip('"').strip("'") for v in re.split(r',(?=\s*")', inner)]
            return [v for v in violations if v]
    except Exception:
        pass
    return [str(val)]

df_clean['violation_list'] = df_clean['violation_type'].apply(parse_violation_types)
df_clean['num_violations'] = df_clean['violation_list'].apply(len)

# --- Violation Severity Score ---
def compute_severity(violations):
    """Sum severity weights for all violation types in a record."""
    if not violations:
        return DEFAULT_SEVERITY
    return sum(VIOLATION_SEVERITY.get(v, DEFAULT_SEVERITY) for v in violations)

df_clean['violation_severity'] = df_clean['violation_list'].apply(compute_severity)

# --- Vehicle Footprint Score ---
df_clean['vehicle_footprint'] = df_clean['vehicle_type'].map(
    lambda x: VEHICLE_FOOTPRINT.get(str(x).upper(), DEFAULT_FOOTPRINT) if pd.notna(x) else DEFAULT_FOOTPRINT
)

# --- Junction Proximity Flag ---
df_clean['is_junction'] = (df_clean['junction_name'] != 'No Junction').astype(int)

# --- Congestion Impact Score ---
# CIS = severity × footprint × (1 + JUNCTION_MULT × junction_flag)
df_clean['congestion_impact_score'] = (
    df_clean['violation_severity'] *
    df_clean['vehicle_footprint'] *
    (1 + JUNCTION_MULT * df_clean['is_junction'])
)

print(f"      Congestion Impact Score stats:")
print(f"        Mean:   {df_clean['congestion_impact_score'].mean():.2f}")
print(f"        Median: {df_clean['congestion_impact_score'].median():.2f}")
print(f"        Max:    {df_clean['congestion_impact_score'].max():.0f}")
print(f"        Std:    {df_clean['congestion_impact_score'].std():.2f}")

# Print top violation types
all_violations = [v for vlist in df_clean['violation_list'] for v in vlist]
viol_counts = Counter(all_violations)
print(f"\n[1.5] Top Violation Types:")
for vtype, count in viol_counts.most_common(10):
    print(f"        {vtype}: {count:,}")

print(f"\n[1.6] Vehicle Type Distribution:")
print(df_clean['vehicle_type'].value_counts().head(10).to_string())

# ============================================================================
# PHASE 2: DBSCAN SPATIAL CLUSTERING
# ============================================================================
print("\n" + "=" * 80)
print("PHASE 2: DBSCAN SPATIAL CLUSTERING")
print("=" * 80)

# Convert eps from meters to radians for haversine
eps_rad = EPS_METERS / (EARTH_RADIUS_KM * 1000)

# Prepare coordinates in radians
coords = np.radians(df_clean[['latitude', 'longitude']].values)

print(f"\n[2.1] Running DBSCAN...")
print(f"      eps = {EPS_METERS}m ({eps_rad:.6f} rad)")
print(f"      min_samples = {MIN_SAMPLES}")
print(f"      Points: {len(coords):,}")

dbscan = DBSCAN(
    eps=eps_rad,
    min_samples=MIN_SAMPLES,
    metric='haversine',
    algorithm='ball_tree',
    n_jobs=-1
)
cluster_labels = dbscan.fit_predict(coords)

df_clean['cluster'] = cluster_labels

n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
n_noise = (cluster_labels == -1).sum()
print(f"\n[2.2] DBSCAN Results:")
print(f"      Clusters found: {n_clusters}")
print(f"      Noise points:   {n_noise:,} ({n_noise/len(df_clean)*100:.1f}%)")
print(f"      Clustered:      {len(df_clean) - n_noise:,} ({(len(df_clean)-n_noise)/len(df_clean)*100:.1f}%)")

# ============================================================================
# PHASE 2b: HOTSPOT AGGREGATION & SCORING
# ============================================================================
print(f"\n[2.3] Aggregating Hotspot Metrics...")

clustered = df_clean[df_clean['cluster'] != -1].copy()

hotspot_stats = clustered.groupby('cluster').agg(
    violation_count=('id', 'count'),
    congestion_impact_index=('congestion_impact_score', 'sum'),
    avg_impact_score=('congestion_impact_score', 'mean'),
    centroid_lat=('latitude', 'mean'),
    centroid_lon=('longitude', 'mean'),
    lat_std=('latitude', 'std'),
    lon_std=('longitude', 'std'),
    unique_vehicles=('vehicle_number', 'nunique'),
    avg_severity=('violation_severity', 'mean'),
    junction_pct=('is_junction', 'mean'),
    peak_hour=('hour', lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else -1),
    dominant_police_station=('police_station', lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else 'Unknown'),
    dominant_junction=('junction_name', lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else 'No Junction'),
).reset_index()

# Dominant violation type per cluster
def get_dominant_violation(group):
    all_v = [v for vlist in group['violation_list'] for v in vlist]
    if all_v:
        return Counter(all_v).most_common(1)[0][0]
    return 'Unknown'

dominant_violations = clustered.groupby('cluster').apply(get_dominant_violation).reset_index()
dominant_violations.columns = ['cluster', 'dominant_violation_type']

# Dominant vehicle type per cluster
dominant_vehicles = clustered.groupby('cluster')['vehicle_type'].agg(
    lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else 'Unknown'
).reset_index()
dominant_vehicles.columns = ['cluster', 'dominant_vehicle_type']

hotspot_stats = hotspot_stats.merge(dominant_violations, on='cluster')
hotspot_stats = hotspot_stats.merge(dominant_vehicles, on='cluster')

# Compute approximate radius in meters (scale longitude by cos(lat): lon degrees are
# shorter than lat degrees away from the equator)
_coslat = np.cos(np.radians(hotspot_stats['centroid_lat']))
hotspot_stats['approx_radius_m'] = np.sqrt(
    hotspot_stats['lat_std']**2 + (hotspot_stats['lon_std'] * _coslat)**2
) * 111000  # degree-to-meter conversion

# Rank by Congestion Impact Index
hotspot_stats = hotspot_stats.sort_values('congestion_impact_index', ascending=False).reset_index(drop=True)
hotspot_stats['rank'] = hotspot_stats.index + 1

# Normalize CII to 0-100 scale for interpretability
scaler = MinMaxScaler(feature_range=(0, 100))
hotspot_stats['cii_normalized'] = scaler.fit_transform(
    hotspot_stats[['congestion_impact_index']]
).flatten()

# Intensity metrics: CII is a SUM, so it is volume-dominated. cii_density (impact per km^2)
# surfaces severe-but-smaller hotspots that raw CII buries; avg_impact_score is per-violation.
_area_km2 = (np.pi * (hotspot_stats['approx_radius_m'].clip(lower=50) / 1000) ** 2).clip(lower=1e-3)
hotspot_stats['cii_density'] = hotspot_stats['congestion_impact_index'] / _area_km2

print(f"      Total hotspots: {len(hotspot_stats)}")
_intense = hotspot_stats.sort_values('avg_impact_score', ascending=False).head(10)
print("\n[2.4b] Top 10 by INTENSITY (avg impact/violation) - severe but not necessarily busiest:")
for _, r in _intense.iterrows():
    print(f"        #{int(r['rank']):>3} CII-rank | {str(r['dominant_police_station'])[:22]:<22} "
          f"avg_impact={r['avg_impact_score']:.1f}  count={int(r['violation_count'])}  "
          f"dominant={str(r['dominant_violation_type'])[:24]}")
print(f"\n[2.4] Top 20 Parking Violation Hotspots by Congestion Impact Index:")
print("-" * 120)
print(f"{'Rank':<5} {'CII':>8} {'CII%':>6} {'Count':>7} {'AvgSev':>7} {'Jct%':>6} {'PeakHr':>7} {'Radius(m)':>10} {'Police Station':<25} {'Dominant Violation':<30}")
print("-" * 120)
for _, row in hotspot_stats.head(20).iterrows():
    print(f"{int(row['rank']):<5} {row['congestion_impact_index']:>8.0f} {row['cii_normalized']:>5.1f}% {int(row['violation_count']):>7} "
          f"{row['avg_severity']:>7.1f} {row['junction_pct']*100:>5.1f}% {int(row['peak_hour']):>7} {row['approx_radius_m']:>10.1f} "
          f"{str(row['dominant_police_station'])[:24]:<25} {str(row['dominant_violation_type'])[:29]:<30}")


# ============================================================================
# PHASE 3: VISUALIZATIONS
# ============================================================================
print("\n" + "=" * 80)
print("PHASE 3: VISUALIZATIONS")
print("=" * 80)

# Set style
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")

# --- PLOT 1: Spatial Scatter of Clusters ---
print("\n[3.1] Generating spatial cluster map...")
fig, ax = plt.subplots(figsize=(14, 12))

# Plot noise points
noise = df_clean[df_clean['cluster'] == -1]
ax.scatter(noise['longitude'], noise['latitude'],
           c='lightgray', s=0.5, alpha=0.2, label=f'Noise ({len(noise):,})')

# Plot clustered points (top 30 clusters with distinct colors)
top_clusters = hotspot_stats.head(30)['cluster'].values
cmap = plt.get_cmap('tab20', min(20, len(top_clusters)))

for i, cid in enumerate(top_clusters):
    cluster_data = df_clean[df_clean['cluster'] == cid]
    color = cmap(i % 20)
    rank = hotspot_stats[hotspot_stats['cluster'] == cid]['rank'].values[0]
    ax.scatter(cluster_data['longitude'], cluster_data['latitude'],
               c=[color], s=8, alpha=0.7, label=f'#{rank} (n={len(cluster_data)})')

# Mark top 10 centroids
for _, row in hotspot_stats.head(10).iterrows():
    ax.annotate(f"#{int(row['rank'])}",
                xy=(row['centroid_lon'], row['centroid_lat']),
                fontsize=9, fontweight='bold', color='red',
                ha='center', va='bottom',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='yellow', alpha=0.8))

ax.set_xlabel('Longitude', fontsize=12)
ax.set_ylabel('Latitude', fontsize=12)
ax.set_title(f'DBSCAN Parking Violation Hotspots in Bengaluru\n'
             f'(eps={EPS_METERS}m, min_samples={MIN_SAMPLES}, {n_clusters} clusters found)',
             fontsize=14, fontweight='bold')
ax.legend(loc='upper left', fontsize=7, ncol=2, markerscale=3)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'hotspot_spatial_map.png'), dpi=150, bbox_inches='tight')
plt.close()
print("      Saved: hotspot_spatial_map.png")

# --- PLOT 2: Top 20 Hotspots Bar Chart ---
print("[3.2] Generating top hotspots bar chart...")
fig, ax = plt.subplots(figsize=(14, 8))
top20 = hotspot_stats.head(20).copy()
top20['label'] = top20.apply(
    lambda r: f"#{int(r['rank'])}: {r['dominant_police_station']}\n({r['dominant_junction'][:30]})", axis=1
)

colors = plt.cm.RdYlGn_r(np.linspace(0.2, 0.9, 20))
bars = ax.barh(range(19, -1, -1), top20['congestion_impact_index'], color=colors, edgecolor='white', height=0.7)
ax.set_yticks(range(19, -1, -1))
ax.set_yticklabels(top20['label'].values, fontsize=8)
ax.set_xlabel('Congestion Impact Index (CII)', fontsize=12)
ax.set_title('Top 20 Illegal Parking Hotspots by Congestion Impact', fontsize=14, fontweight='bold')

# Add value labels
for i, (idx, row) in enumerate(top20.iterrows()):
    ax.text(row['congestion_impact_index'] + 20, 19 - i,
            f"{row['congestion_impact_index']:.0f}  ({int(row['violation_count'])} violations)",
            va='center', fontsize=8, color='#333')

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'top20_hotspots_cii.png'), dpi=150, bbox_inches='tight')
plt.close()
print("      Saved: top20_hotspots_cii.png")

# --- PLOT 3: Temporal Heatmap (Hour × Day of Week) ---
print("[3.3] Generating temporal heatmap...")
fig, axes = plt.subplots(1, 2, figsize=(18, 7))

# All violations
day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
temporal = df_clean.groupby(['day_name', 'hour']).size().unstack(fill_value=0)
temporal = temporal.reindex(day_order)

sns.heatmap(temporal, cmap='YlOrRd', ax=axes[0], cbar_kws={'label': 'Violation Count'})
axes[0].set_title('All Parking Violations by Hour & Day', fontsize=13, fontweight='bold')
axes[0].set_xlabel('Hour of Day')
axes[0].set_ylabel('')

# Top 10 hotspot violations only
top10_data = df_clean[df_clean['cluster'].isin(hotspot_stats.head(10)['cluster'].values)]
temporal_top = top10_data.groupby(['day_name', 'hour']).size().unstack(fill_value=0)
temporal_top = temporal_top.reindex(day_order).fillna(0)

sns.heatmap(temporal_top, cmap='YlOrRd', ax=axes[1], cbar_kws={'label': 'Violation Count'})
axes[1].set_title('Top 10 Hotspot Violations by Hour & Day', fontsize=13, fontweight='bold')
axes[1].set_xlabel('Hour of Day')
axes[1].set_ylabel('')

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'temporal_heatmap.png'), dpi=150, bbox_inches='tight')
plt.close()
print("      Saved: temporal_heatmap.png")

# --- PLOT 4: Violation Type Distribution in Top Hotspots ---
print("[3.4] Generating violation type analysis...")
fig, axes = plt.subplots(1, 2, figsize=(16, 7))

# Violation type counts across all data
all_v_flat = [v for vlist in df_clean['violation_list'] for v in vlist]
v_counter = Counter(all_v_flat)
v_df = pd.DataFrame(v_counter.most_common(8), columns=['violation', 'count'])
colors_v = plt.cm.Set2(np.linspace(0, 1, len(v_df)))
axes[0].barh(range(len(v_df)-1, -1, -1), v_df['count'], color=colors_v, edgecolor='white')
axes[0].set_yticks(range(len(v_df)-1, -1, -1))
axes[0].set_yticklabels(v_df['violation'].values, fontsize=9)
axes[0].set_xlabel('Count')
axes[0].set_title('Violation Type Distribution (All Data)', fontsize=13, fontweight='bold')

# Vehicle type in top 10 hotspots
veh_counts = top10_data['vehicle_type'].value_counts().head(8)
colors_veh = plt.cm.Paired(np.linspace(0, 1, len(veh_counts)))
axes[1].barh(range(len(veh_counts)-1, -1, -1), veh_counts.values, color=colors_veh, edgecolor='white')
axes[1].set_yticks(range(len(veh_counts)-1, -1, -1))
axes[1].set_yticklabels(veh_counts.index, fontsize=9)
axes[1].set_xlabel('Count')
axes[1].set_title('Vehicle Types in Top 10 Hotspots', fontsize=13, fontweight='bold')

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'violation_vehicle_analysis.png'), dpi=150, bbox_inches='tight')
plt.close()
print("      Saved: violation_vehicle_analysis.png")

# --- PLOT 5: Congestion Impact Score Distribution ---
print("[3.5] Generating CII distribution plot...")
fig, axes = plt.subplots(1, 2, figsize=(16, 6))

# Histogram of per-record impact scores
axes[0].hist(df_clean['congestion_impact_score'], bins=50, color='steelblue',
             edgecolor='white', alpha=0.8)
axes[0].set_xlabel('Congestion Impact Score (per violation)')
axes[0].set_ylabel('Frequency')
axes[0].set_title('Distribution of Individual Congestion Impact Scores', fontsize=12, fontweight='bold')
axes[0].axvline(df_clean['congestion_impact_score'].mean(), color='red',
                linestyle='--', label=f"Mean: {df_clean['congestion_impact_score'].mean():.1f}")
axes[0].legend()

# Box plot of CII across top 15 hotspots
top15_clusters = hotspot_stats.head(15)['cluster'].values
top15_data = df_clean[df_clean['cluster'].isin(top15_clusters)].copy()
top15_data['cluster_rank'] = top15_data['cluster'].map(
    dict(zip(hotspot_stats['cluster'], hotspot_stats['rank']))
)
sns.boxplot(data=top15_data, x='cluster_rank', y='congestion_impact_score',
            ax=axes[1], palette='RdYlGn_r')
axes[1].set_xlabel('Hotspot Rank')
axes[1].set_ylabel('Congestion Impact Score')
axes[1].set_title('Impact Score Distribution Across Top 15 Hotspots', fontsize=12, fontweight='bold')

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'cii_distribution.png'), dpi=150, bbox_inches='tight')
plt.close()
print("      Saved: cii_distribution.png")

# --- PLOT 6: Police Station Level Aggregation ---
print("[3.6] Generating police station analysis...")
station_stats = df_clean.groupby('police_station').agg(
    total_violations=('id', 'count'),
    total_cii=('congestion_impact_score', 'sum'),
    avg_severity=('violation_severity', 'mean'),
    junction_pct=('is_junction', 'mean'),
    unique_locations=('location', 'nunique'),
).reset_index().sort_values('total_cii', ascending=False)

fig, ax = plt.subplots(figsize=(14, 10))
top_stations = station_stats.head(20)
colors_st = plt.cm.viridis(np.linspace(0.2, 0.9, 20))
ax.barh(range(19, -1, -1), top_stations['total_cii'], color=colors_st, edgecolor='white', height=0.7)
ax.set_yticks(range(19, -1, -1))
ax.set_yticklabels(top_stations['police_station'].values, fontsize=10)
ax.set_xlabel('Total Congestion Impact Index', fontsize=12)
ax.set_title('Top 20 Police Stations by Aggregated Congestion Impact', fontsize=14, fontweight='bold')

for i, (_, row) in enumerate(top_stations.iterrows()):
    ax.text(row['total_cii'] + 50, 19 - i,
            f"{int(row['total_violations'])} violations | Jct: {row['junction_pct']*100:.0f}%",
            va='center', fontsize=8, color='#333')

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'police_station_impact.png'), dpi=150, bbox_inches='tight')
plt.close()
print("      Saved: police_station_impact.png")


# ============================================================================
# PHASE 4: OUTPUT CSV FILES
# ============================================================================
print("\n" + "=" * 80)
print("PHASE 4: SAVING OUTPUT FILES")
print("=" * 80)

# Hotspot Summary CSV
hotspot_output_cols = [
    'rank', 'cluster', 'violation_count', 'congestion_impact_index', 'cii_normalized',
    'cii_density', 'avg_impact_score', 'avg_severity', 'junction_pct', 'peak_hour',
    'centroid_lat', 'centroid_lon', 'approx_radius_m',
    'dominant_police_station', 'dominant_junction', 'dominant_violation_type',
    'dominant_vehicle_type', 'unique_vehicles'
]
hotspot_path = os.path.join(OUTPUT_DIR, 'hotspot_summary.csv')
hotspot_stats[hotspot_output_cols].to_csv(hotspot_path, index=False)
print(f"\n[4.1] Saved: {hotspot_path}")
print(f"      {len(hotspot_stats)} hotspots with CII rankings")

# Clustered violations CSV (full data with cluster labels and scores)
clustered_output_cols = [
    'id', 'latitude', 'longitude', 'location', 'vehicle_type', 'violation_type',
    'created_datetime', 'police_station', 'junction_name',
    'cluster', 'violation_severity', 'vehicle_footprint', 'is_junction',
    'congestion_impact_score', 'hour', 'day_of_week', 'month'
]
clustered_path = os.path.join(OUTPUT_DIR, 'clustered_violations.csv')
df_clean[clustered_output_cols].to_csv(clustered_path, index=False)
print(f"\n[4.2] Saved: {clustered_path}")
print(f"      {len(df_clean):,} records with cluster labels and impact scores")

# Station-level summary
station_path = os.path.join(OUTPUT_DIR, 'station_summary.csv')
station_stats.to_csv(station_path, index=False)
print(f"\n[4.3] Saved: {station_path}")

# ============================================================================
# FINAL SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("ANALYSIS COMPLETE - SUMMARY")
print("=" * 80)
print(f"""
Dataset:         {len(df):,} raw records -> {len(df_clean):,} clean approved records
DBSCAN:          eps={EPS_METERS}m, min_samples={MIN_SAMPLES}
Clusters Found:  {n_clusters} hotspots
Noise Points:    {n_noise:,} ({n_noise/len(df_clean)*100:.1f}%)

Top 5 Congestion Hotspots:
""")
for _, row in hotspot_stats.head(5).iterrows():
    print(f"  #{int(row['rank'])} - {row['dominant_police_station']} | "
          f"{row['dominant_junction']} | "
          f"CII: {row['congestion_impact_index']:.0f} | "
          f"{int(row['violation_count'])} violations | "
          f"Peak Hour: {int(row['peak_hour'])}:00 | "
          f"Dominant: {row['dominant_violation_type']}")

print(f"""
Output Files:
  [PLOT] {os.path.join(OUTPUT_DIR, 'hotspot_spatial_map.png')}
  [PLOT] {os.path.join(OUTPUT_DIR, 'top20_hotspots_cii.png')}
  [PLOT] {os.path.join(OUTPUT_DIR, 'temporal_heatmap.png')}
  [PLOT] {os.path.join(OUTPUT_DIR, 'violation_vehicle_analysis.png')}
  [PLOT] {os.path.join(OUTPUT_DIR, 'cii_distribution.png')}
  [PLOT] {os.path.join(OUTPUT_DIR, 'police_station_impact.png')}
  [CSV]  {hotspot_path}
  [CSV]  {clustered_path}
  [CSV]  {station_path}
""")
