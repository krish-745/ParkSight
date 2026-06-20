import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { GeoPoint } from "@/data/api";
import "leaflet/dist/leaflet.css";

function heatColor(t: number): string {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    const u = t / 0.5;
    return `rgb(${Math.round(56 + (245 - 56) * u)},${Math.round(178 + (166 - 178) * u)},${Math.round(172 + (35 - 172) * u)})`;
  }
  const u = (t - 0.5) / 0.5;
  return `rgb(${Math.round(245 + (239 - 245) * u)},${Math.round(166 + (68 - 166) * u)},${Math.round(35 + (68 - 35) * u)})`;
}

function Dots({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  const ref = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (ref.current) map.removeLayer(ref.current);
    if (!points.length) return;
    const group = L.layerGroup();
    const maxV = Math.max(1, ...points.map((h) => h.violations));
    for (const h of points) {
      const radius = 2 + 9 * Math.sqrt(h.violations / maxV);
      const color = heatColor(h.intensity);
      L.circleMarker([h.lat, h.lon], { radius, color, fillColor: color, fillOpacity: 0.7, weight: 1 })
        .bindTooltip(`<b>${h.name}</b> · ${h.violations.toLocaleString("en-IN")}`, { sticky: true })
        .addTo(group);
    }
    group.addTo(map);
    ref.current = group;
    return () => { if (ref.current) map.removeLayer(ref.current); };
  }, [points, map]);
  return null;
}

/** Compact, interactive (pan + zoom buttons) Leaflet map for dashboard tiles.
 *  Scroll-wheel zoom is off so the page keeps scrolling normally over the tile. */
export function MiniMap({ points, className }: { points: GeoPoint[]; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={className} style={{ background: "#0d1117" }} />;
  return (
    <MapContainer
      center={[12.972, 77.594]}
      zoom={11}
      scrollWheelZoom={false}
      zoomControl
      attributionControl={false}
      className={className}
      style={{ background: "#0d1117" }}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" maxZoom={19} />
      <Dots points={points} />
    </MapContainer>
  );
}
