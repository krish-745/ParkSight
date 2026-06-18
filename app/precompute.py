"""
One-time precompute: enrich the hotspots with road geometry (OSM lanes + class) so the API
never needs to load the 258k-node graph at runtime.

Reuses add_capacity_loss() from the enforcement_optimizer. Produces:
  app/data/hotspots_enriched.csv   (hotspot_summary + road_class, lanes, capacity_loss_factor, impact)

Run once (after parking_hotspot_analysis.py):  python app/precompute.py
"""

import os
import sys
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)                 # Flipkart_Round2/
sys.path.insert(0, PROJ)                      # to import enforcement_optimizer
OUT = os.path.join(PROJ, "output")
APP_DATA = os.path.join(HERE, "data")
os.makedirs(APP_DATA, exist_ok=True)


def main():
    src = os.path.join(OUT, "hotspot_summary.csv")
    hs = pd.read_csv(src)
    print(f"Loaded {len(hs)} hotspots from {src}")

    try:
        from enforcement_optimizer import add_capacity_loss
        hs = add_capacity_loss(hs)            # adds road_class, lanes, capacity_loss_factor, impact
    except Exception as e:
        print(f"[warn] road grounding failed ({e}); impact = raw CII")
        hs["road_class"] = "n/a"
        hs["lanes"] = 0
        hs["capacity_loss_factor"] = 1.0
        hs["impact"] = hs["congestion_impact_index"]

    dst = os.path.join(APP_DATA, "hotspots_enriched.csv")
    hs.to_csv(dst, index=False)
    print(f"Saved enriched hotspots -> {dst}")
    print(f"  columns: {list(hs.columns)}")


if __name__ == "__main__":
    main()
