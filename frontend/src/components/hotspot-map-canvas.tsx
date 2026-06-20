// Client-only Leaflet canvas for the hotspot map.
// This module is loaded via a dynamic import (see hotspot-map.tsx) so that
// Leaflet — which touches `window` at import time — never runs during SSR.
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { GeoPoint, BlindSpot, RawViolation, DisplacementResp } from "@/data/api";
import { heatColor } from "@/lib/heat";

import "leaflet/dist/leaflet.css";

// True hex-grid density: bins every cluster's violations into screen-space hex cells.
function drawHexGrid(map: L.Map, canvas: HTMLCanvasElement, points: GeoPoint[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = map.getSize();
  canvas.width = size.x;
  canvas.height = size.y;
  ctx.clearRect(0, 0, size.x, size.y);

  const HEX_R = 22;
  const bins = new Map<string, number>();
  for (const h of points) {
    const pt = map.latLngToContainerPoint([h.lat, h.lon]);
    const col = Math.round(pt.x / (HEX_R * 1.732));
    const row = Math.round(pt.y / (HEX_R * 1.5));
    const key = `${col},${row}`;
    bins.set(key, (bins.get(key) ?? 0) + h.violations);
  }
  const maxBin = Math.max(1, ...bins.values());
  const cols = Math.ceil(size.x / (HEX_R * 1.732)) + 2;
  const rows = Math.ceil(size.y / (HEX_R * 1.5)) + 2;

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const val = bins.get(`${c},${r}`) ?? 0;
      if (!val) continue;
      const x = c * HEX_R * 1.732 + (r % 2 === 0 ? 0 : HEX_R * 0.866);
      const y = r * HEX_R * 1.5;
      const intensity = Math.min(1, val / maxBin);
      const alpha = 0.18 + intensity * 0.6;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + HEX_R * Math.cos(a);
        const py = y + HEX_R * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = heatColor(intensity).replace("rgb", "rgba").replace(")", `,${alpha})`);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.22})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}

export interface HotspotMapCanvasProps {
  points: GeoPoint[];
  blindZones: BlindSpot[];
  rawViolations: RawViolation[];
  layers: { id: string; on: boolean }[];
  selected: GeoPoint | null;
  setSelected: (h: GeoPoint | null) => void;
  hourlyById: Map<string, number[]> | null;
  timeOn: boolean;
  hour: number;
  displacement: DisplacementResp | null;
  onReady: () => void;
}

function ImperativeMapLayers({
  points, blindZones, rawViolations, layers, selected, setSelected,
  hourlyById, timeOn, hour, displacement,
}: Omit<HotspotMapCanvasProps, "onReady">) {
  const map = useMap();
  const dotsRef = useRef<L.LayerGroup | null>(null);
  const blindRef = useRef<L.LayerGroup | null>(null);
  const rawRef = useRef<L.LayerGroup | null>(null);
  const dispRef = useRef<L.LayerGroup | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const on = (id: string, dflt = false) => layers.find((l) => l.id === id)?.on ?? dflt;
  const showHexbin = on("hexbin");
  const showDots = on("hotspots", true);
  const showBlind = on("blind");
  const showRaw = on("violations");

  // ── Hexbin canvas overlay (true grid density) ──
  // The canvas lives in Leaflet's overlay pane (above tiles, below markers).
  // We re-anchor it to the pane's current top-left on every move so it stays
  // aligned, and size it in real pixels (no % sizing — the pane has no size).
  useEffect(() => {
    const pane = map.getPanes().overlayPane;
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "hexbin-canvas leaflet-zoom-hide";
      canvas.style.cssText = "position:absolute;pointer-events:none;";
      pane.appendChild(canvas);
      canvasRef.current = canvas;
    }

    if (!showHexbin) {
      canvas.style.display = "none";
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    canvas.style.display = "block";
    const redraw = () => {
      const c = canvasRef.current;
      if (!c) return;
      L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
      drawHexGrid(map, c, points);
    };
    redraw();
    map.on("move zoom viewreset zoomend moveend resize", redraw);
    return () => { map.off("move zoom viewreset zoomend moveend resize", redraw); };
  }, [map, points, showHexbin]);

  // ── Raw violations: sampled individual points (tiny dots, non-interactive) ──
  useEffect(() => {
    if (rawRef.current) { map.removeLayer(rawRef.current); rawRef.current = null; }
    if (!showRaw || !rawViolations.length) return;
    const group = L.layerGroup();
    for (const v of rawViolations) {
      L.circleMarker([v.lat, v.lon], {
        radius: 1.6, color: "#38b2ac", fillColor: "#38b2ac",
        fillOpacity: 0.45, weight: 0, interactive: false,
      }).addTo(group);
    }
    group.addTo(map);
    rawRef.current = group;
    return () => { if (rawRef.current) map.removeLayer(rawRef.current); };
  }, [rawViolations, map, showRaw]);

  // ── Blind spots: under-enforced high-impact zones (hollow pulsing rings) ──
  useEffect(() => {
    if (blindRef.current) { map.removeLayer(blindRef.current); blindRef.current = null; }
    if (!showBlind || !blindZones.length) return;
    const group = L.layerGroup();
    for (const b of blindZones) {
      const ring = L.circleMarker([b.lat, b.lon], {
        radius: 13, color: "#c9d1d9", fillColor: "#c9d1d9",
        fillOpacity: 0.06, weight: 1.5, dashArray: "4 3",
      });
      ring.bindPopup(
        `<div style="min-width:200px;font-family:inherit">
          <div style="font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8b949e;margin-bottom:4px">Blind spot · ${b.severity}</div>
          <b style="font-size:14px">${b.station}</b>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:12px;margin-top:8px">
            <span style="color:#8b949e">Violations</span><span>${b.violations.toLocaleString("en-IN")}</span>
            <span style="color:#8b949e">Impact</span><span>${b.cii_normalized.toFixed(0)}/100</span>
            <span style="color:#8b949e">Type</span><span>${b.dominant_violation}</span>
            <span style="color:#8b949e">Shift</span><span>${b.shift}</span>
          </div>
          <div style="font-size:11px;color:#8b949e;margin-top:8px;line-height:1.4">High predicted impact, relatively low current enforcement.</div>
        </div>`,
        { maxWidth: 260 },
      );
      group.addLayer(ring);
    }
    group.addTo(map);
    blindRef.current = group;
    return () => { if (blindRef.current) map.removeLayer(blindRef.current); };
  }, [blindZones, map, showBlind]);

  // ── Hotspot clusters: sized/colored dots → open the detail drawer ──
  // When the Time Machine is on, intensity/size are driven by the hotspot's
  // real intensity at the selected hour (so the heatmap "breathes" across the day).
  useEffect(() => {
    if (dotsRef.current) { map.removeLayer(dotsRef.current); dotsRef.current = null; }
    if (!showDots) return;
    const group = L.layerGroup();
    const maxV = Math.max(1, ...points.map((h) => h.violations));
    for (const h of points) {
      let radius: number, color: string, inten: number;
      if (timeOn && hourlyById) {
        inten = hourlyById.get(h.id)?.[hour] ?? 0;
        radius = 2 + 13 * Math.sqrt(inten);
        color = heatColor(inten);
      } else {
        inten = h.intensity;
        radius = 3 + 12 * Math.sqrt(h.violations / maxV);
        color = heatColor(h.intensity);
      }
      const marker = L.circleMarker([h.lat, h.lon], {
        radius: Math.max(radius, timeOn ? 0.5 : 3),
        color: selected?.id === h.id ? "#ffffff" : color,
        fillColor: color,
        fillOpacity: timeOn ? 0.35 + inten * 0.5 : 0.7,
        weight: selected?.id === h.id ? 2 : 1,
      });
      const label = timeOn
        ? `<b>${h.name}</b> · ${Math.round(inten * 100)}% @ ${String(hour).padStart(2, "0")}:00`
        : `<b>${h.name}</b> · ${h.violations.toLocaleString("en-IN")}`;
      marker.bindTooltip(label, { sticky: true });
      marker.on("click", () => setSelected(h));
      group.addLayer(marker);
    }
    group.addTo(map);
    dotsRef.current = group;
    return () => { if (dotsRef.current) map.removeLayer(dotsRef.current); };
  }, [points, map, showDots, selected, setSelected, timeOn, hour, hourlyById]);

  // ── Displacement / spill-over: flow lines from a cleared hotspot to where
  //    its parking demand re-routes (learned graph random walk). ──
  useEffect(() => {
    if (dispRef.current) { map.removeLayer(dispRef.current); dispRef.current = null; }
    if (!displacement || !displacement.receivers.length) return;
    const group = L.layerGroup();
    const src = displacement.source;
    const maxShare = Math.max(...displacement.receivers.map((r) => r.share), 0.001);
    for (const r of displacement.receivers) {
      const t = r.share / maxShare;
      L.polyline([[src.lat, src.lon], [r.lat, r.lon]], {
        color: "#f5a623", weight: 1 + t * 3.5, opacity: 0.25 + t * 0.5,
      }).addTo(group);
      L.circleMarker([r.lat, r.lon], {
        radius: 3 + t * 7, color: "#f5a623", fillColor: "#f5a623",
        fillOpacity: 0.55, weight: 1,
      }).bindTooltip(`<b>${r.name}</b> · absorbs ${Math.round(r.share * 100)}% of displaced demand`, { sticky: true })
        .addTo(group);
    }
    // source marker on top
    L.circleMarker([src.lat, src.lon], {
      radius: 8, color: "#ffffff", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2,
    }).bindTooltip(`<b>${src.name}</b> · cleared`, { sticky: true }).addTo(group);
    group.addTo(map);
    dispRef.current = group;
    return () => { if (dispRef.current) map.removeLayer(dispRef.current); };
  }, [displacement, map]);

  return null;
}

export default function HotspotMapCanvas({ onReady, ...layerProps }: HotspotMapCanvasProps) {
  return (
    <MapContainer
      center={[12.972, 77.594]}
      zoom={12}
      scrollWheelZoom
      zoomControl={false}
      preferCanvas
      className="absolute inset-0 w-full h-full bg-[#0d1117]"
      whenReady={onReady}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" maxZoom={19} />
      <ImperativeMapLayers {...layerProps} />
    </MapContainer>
  );
}
