// Client-only Leaflet canvas for the homepage mini-map.
// Loaded via dynamic import (see mini-map.tsx) so Leaflet never runs during SSR.
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { GeoPoint } from "@/data/api";
import { heatColor } from "@/lib/heat";
import "leaflet/dist/leaflet.css";

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

export default function MiniMapCanvas({ points, className }: { points: GeoPoint[]; className?: string }) {
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
