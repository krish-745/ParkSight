import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import type { Hotspot } from "./api";

function heat(norm: number): string {
  const t = Math.max(0, Math.min(1, norm / 100));
  const a = t < 0.5 ? [45, 212, 191] : [245, 166, 35];
  const b = t < 0.5 ? [245, 166, 35] : [239, 68, 68];
  const u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function HotspotMap({ hotspots }: { hotspots: Hotspot[] }) {
  const maxV = Math.max(1, ...hotspots.map((h) => h.violations));
  return (
    <MapContainer
      center={[12.972, 77.594]}
      zoom={11}
      scrollWheelZoom
      attributionControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      {hotspots.map((h) => {
        const c = heat(h.cii_normalized);
        return (
          <CircleMarker
            key={h.id}
            center={[h.lat, h.lon]}
            radius={3 + 15 * Math.sqrt(h.violations / maxV)}
            pathOptions={{ color: c, fillColor: c, fillOpacity: 0.5, weight: 1 }}
          >
            <Tooltip>
              {h.station} · {h.violations.toLocaleString("en-IN")} violations
            </Tooltip>
            <Popup>
              <b>#{h.rank} {h.station}</b>
              <br />
              {h.violations.toLocaleString("en-IN")} violations · {h.dominant_violation}
              <br />
              {h.road_class ?? "n/a"} · {h.shift}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
