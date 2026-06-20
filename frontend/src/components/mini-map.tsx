import { lazy, Suspense, useEffect, useState } from "react";
import type { GeoPoint } from "@/data/api";

// Leaflet touches `window` at import time, so the actual map lives in a
// client-only module loaded via dynamic import. The server (and the first
// client render) shows a dark placeholder, then the map swaps in on mount.
const MiniMapCanvas = lazy(() => import("./mini-map-canvas"));

/** Compact, interactive (pan + zoom buttons) Leaflet map for dashboard tiles.
 *  Scroll-wheel zoom is off so the page keeps scrolling normally over the tile. */
export function MiniMap({ points, className }: { points: GeoPoint[]; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const placeholder = <div className={className} style={{ background: "#0d1117" }} />;
  if (!mounted) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <MiniMapCanvas points={points} className={className} />
    </Suspense>
  );
}
