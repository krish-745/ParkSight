# DBSCAN Parking Violation Hotspot Analysis - Results Walkthrough

## Overview

Successfully analyzed **298,450 parking violation records** from Bengaluru police (Nov 2023 - Apr 2024) using DBSCAN spatial clustering to identify illegal parking hotspots and quantify their congestion impact.

| Metric | Value |
|--------|-------|
| Raw records | 298,450 |
| Approved & cleaned records | 115,350 (38.7%) |
| DBSCAN parameters | eps=50m, min_samples=10 |
| **Clusters (hotspots) found** | **612** |
| Clustered violations | 107,417 (93.1%) |
| Noise points | 7,933 (6.9%) |

---

## Key Findings

### 1. Spatial Hotspot Map

DBSCAN identified **612 distinct parking violation hotspots** across Bengaluru. The spatial distribution clearly shows concentration in the central business district (Upparpet, Shivajinagar, Malleshwaram) with secondary clusters in suburban commercial areas (HAL Old Airport, Vijayanagara).

![DBSCAN Spatial Cluster Map](C:/Users/rahul/.gemini/antigravity/brain/dc6fda40-6e02-422d-af9a-f961908a3666/hotspot_spatial_map.png)

> [!IMPORTANT]
> **93.1% of violations** fall into identifiable hotspot clusters, meaning parking violations are highly concentrated and NOT random - this validates the DBSCAN approach.

---

### 2. Top 20 Hotspots Ranked by Congestion Impact Index (CII)

The CII formula weights each violation by: `Severity x Vehicle Footprint x (1 + Junction Flag)`

| Rank | Area | Junction | CII | Violations | Junction% | Peak Hour |
|------|------|----------|-----|------------|-----------|-----------|
| #1 | **Upparpet** | Elite Junction | 128,933 | 22,864 | 97.8% | 3:00 |
| #2 | **Shivajinagar** | Safina Plaza Junction | 48,759 | 9,821 | 81.9% | 5:00 |
| #3 | **Malleshwaram** | Modi Bridge Junction | 19,854 | 3,502 | 100% | 2:00 |
| #4 | **Malleshwaram** | No Junction | 15,169 | 3,422 | 45.5% | 4:00 |
| #5 | **HAL Old Airport** | No Junction | 13,606 | 2,946 | 0% | 23:00 |

![Top 20 Hotspots by CII](C:/Users/rahul/.gemini/antigravity/brain/dc6fda40-6e02-422d-af9a-f961908a3666/top20_hotspots_cii.png)

> [!WARNING]
> **Upparpet (Elite Junction)** dominates with CII = 128,933 - nearly **2.6x the second-ranked hotspot**. With 22,864 violations and 97.8% junction proximity, this is the single highest-priority enforcement zone for congestion relief.

---

### 3. Temporal Patterns

````carousel
#### All Violations - Temporal Heatmap
![Temporal Heatmap](C:/Users/rahul/.gemini/antigravity/brain/dc6fda40-6e02-422d-af9a-f961908a3666/temporal_heatmap.png)
<!-- slide -->
#### Key Temporal Insights

| Pattern | Detail |
|---------|--------|
| **Peak hours (all)** | 0:00-6:00 and 18:00-23:00 |
| **Peak hours (top 10)** | Even more concentrated in 0:00-6:00 |
| **Peak days** | Thursday and Sunday show highest activity |
| **Low activity** | 8:00-15:00 across all days |

> [!NOTE]
> The night/early-morning peak suggests violations cluster during **off-duty enforcement hours**, indicating a need for automated monitoring during these windows.
````

---

### 4. Violation & Vehicle Type Breakdown

![Violation and Vehicle Analysis](C:/Users/rahul/.gemini/antigravity/brain/dc6fda40-6e02-422d-af9a-f961908a3666/violation_vehicle_analysis.png)

- **WRONG PARKING** (60,150) and **NO PARKING** (57,186) dominate, accounting for ~90% of all violations
- **PARKING IN A MAIN ROAD** (8,571) is the most congestion-impactful type despite lower frequency
- In top hotspots, **Scooters and Cars** are the most frequent violators, but **Passenger Autos** are disproportionately represented

---

### 5. Congestion Impact Score Distribution

![CII Distribution](C:/Users/rahul/.gemini/antigravity/brain/dc6fda40-6e02-422d-af9a-f961908a3666/cii_distribution.png)

- Mean per-violation impact score: **4.9** (right-skewed distribution)
- Hotspots #5 and #7 (HAL Old Airport) have **higher median impact scores** despite fewer violations, due to heavier vehicles and multiple violation types
- Outlier violations (score 40-80) represent multi-violation records with large vehicles at junctions

---

### 6. Police Station-Level Enforcement Priority

![Police Station Impact](C:/Users/rahul/.gemini/antigravity/brain/dc6fda40-6e02-422d-af9a-f961908a3666/police_station_impact.png)

> [!TIP]
> **Top 5 stations for enforcement priority**: Upparpet, Shivajinagar, HAL Old Airport, Malleshwaram, Vijayanagara - these account for the majority of congestion impact.

---

## Files Produced

| File | Description |
|------|-------------|
| [parking_hotspot_analysis.py](file:///c:/Users/rahul/Downloads/Flipkart_Round2/parking_hotspot_analysis.py) | Main analysis script |
| [hotspot_summary.csv](file:///c:/Users/rahul/Downloads/Flipkart_Round2/output/hotspot_summary.csv) | 612 hotspots ranked by CII with all metrics |
| [clustered_violations.csv](file:///c:/Users/rahul/Downloads/Flipkart_Round2/output/clustered_violations.csv) | 115K records with cluster labels & impact scores |
| [station_summary.csv](file:///c:/Users/rahul/Downloads/Flipkart_Round2/output/station_summary.csv) | Police station-level aggregation |

---

## Methodology

### DBSCAN Configuration
- **Metric**: Haversine (great-circle distance on lat/lon in radians)
- **eps**: 50 meters (converted to 0.000008 radians) - typical road segment influence zone
- **min_samples**: 10 - minimum violations to form a viable hotspot
- **Algorithm**: BallTree for efficient spatial indexing

### Congestion Impact Score Formula
$$CIS = \text{Violation Severity} \times \text{Vehicle Footprint} \times (1 + \text{Junction Flag})$$

Where:
- **Violation Severity**: DOUBLE PARKING(5), MAIN ROAD(4), BUS STOP(4), ROAD CROSSING(3), WRONG/NO PARKING(2)
- **Vehicle Footprint**: TANKER/BUS(3), CAR/MAXI-CAB(2), SCOOTER/AUTO(1)
- **Junction Flag**: 1 if at named junction (2x multiplier), 0 otherwise

### Congestion Impact Index (CII) per Hotspot
$$CII = \sum_{i \in \text{cluster}} CIS_i$$
