import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import {
  useLive, apiGetHotspots, apiGetBlindspots, apiGetViolations,
  apiGetHotspotHourly, apiGetDisplacement, toGeoPoints,
} from "@/data/api";
import type { GeoPoint, BlindSpot, RawViolation, HotspotHourly, DisplacementResp } from "@/data/api";
import { Search, X, ChevronDown, ChevronUp, Play, Pause, Clock, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/hotspot-map")({
  head: () => ({
    meta: [
      { title: "Hotspot Map — ParkSight" },
      { name: "description", content: "Interactive parking-violation hotspot map with hexbin congestion, blind-spot and raw-violation layers." },
    ],
  }),
  component: HotspotMapPage,
});

// teal → orange → red, matching the design tokens
function heatColor(t: number): string {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    const u = t / 0.5;
    return `rgb(${Math.round(56 + (245 - 56) * u)},${Math.round(178 + (166 - 178) * u)},${Math.round(172 + (35 - 172) * u)})`;
  }
  const u = (t - 0.5) / 0.5;
  return `rgb(${Math.round(245 + (239 - 245) * u)},${Math.round(166 + (68 - 166) * u)},${Math.round(35 + (68 - 35) * u)})`;
}

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

function ImperativeMapLayers({
  points, blindZones, rawViolations, layers, selected, setSelected,
  hourlyById, timeOn, hour, displacement,
}: {
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
}) {
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
  useEffect(() => {
    const container = map.getContainer();
    let canvas = container.querySelector(".hexbin-canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "hexbin-canvas";
      canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:400;";
      container.querySelector(".leaflet-overlay-pane")?.appendChild(canvas);
    }
    canvasRef.current = canvas;
    const redraw = () => { if (showHexbin && canvasRef.current) drawHexGrid(map, canvasRef.current, points); };
    map.on("moveend zoomend resize", redraw);
    return () => { map.off("moveend zoomend resize", redraw); };
  }, [map, points, showHexbin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (showHexbin) { drawHexGrid(map, canvas, points); canvas.style.display = "block"; }
    else {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = "none";
    }
  }, [showHexbin, points, map]);

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

const initialLayers = [
  { id: "hotspots", label: "Hotspot clusters", color: "#f5a623", on: true },
  { id: "hexbin", label: "Hexbin congestion", color: "#ef4444", on: false },
  { id: "blind", label: "Blind spots", color: "#c9d1d9", on: false },
  { id: "violations", label: "Raw violations", color: "#38b2ac", on: false },
];

const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function HotspotMapPage() {
  const points = useLive<GeoPoint[]>(() => apiGetHotspots(600).then(toGeoPoints), []);
  const blindZones = useLive<BlindSpot[]>(() => apiGetBlindspots(40).then((r) => r.zones), []);
  const rawViolations = useLive<RawViolation[]>(() => apiGetViolations(2500), []);
  const hourlyResp = useLive<HotspotHourly[]>(() => apiGetHotspotHourly().then((r) => r.hotspots), []);

  const [layers, setLayers] = useState(initialLayers);
  const [selected, setSelected] = useState<GeoPoint | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // Time Machine (hour-of-day scrubber)
  const [timeOn, setTimeOn] = useState(false);
  const [hour, setHour] = useState(18);
  const [playing, setPlaying] = useState(false);

  // Displacement / spill-over preview for the selected hotspot
  const [displacement, setDisplacement] = useState<DisplacementResp | null>(null);
  const [dispLoading, setDispLoading] = useState(false);

  // id (`H-123`) → 24-hour intensity profile
  const hourlyById = useRef<Map<string, number[]>>(new Map()).current;
  useEffect(() => {
    hourlyById.clear();
    for (const h of hourlyResp) hourlyById.set(`H-${h.id}`, h.hourly);
  }, [hourlyResp, hourlyById]);

  // per-hour citywide intensity (drives the mini bar strip under the slider)
  const hourTotals = (() => {
    const t = new Array(24).fill(0);
    for (const h of hourlyResp) for (let i = 0; i < 24; i++) t[i] += h.hourly[i] ?? 0;
    const max = Math.max(1, ...t);
    return t.map((v) => v / max);
  })();

  // playback loop
  useEffect(() => {
    if (!playing || !timeOn) return;
    const id = setInterval(() => setHour((h) => (h + 1) % 24), 700);
    return () => clearInterval(id);
  }, [playing, timeOn]);

  const counts: Record<string, number> = {
    hotspots: points.length,
    hexbin: points.length,
    blind: blindZones.length,
    violations: rawViolations.length,
  };

  const auto = useRef(false);
  useEffect(() => {
    if (!auto.current && points.length) { setSelected(points[0]); auto.current = true; }
  }, [points]);

  const toggleLayer = (id: string) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, on: !l.on } : l)));

  // clear any displacement overlay when the selected hotspot changes
  useEffect(() => { setDisplacement(null); }, [selected]);

  const showDisplacement = async () => {
    if (!selected) return;
    const numId = Number(selected.id.replace("H-", ""));
    setDispLoading(true);
    try { setDisplacement(await apiGetDisplacement(numId, 4)); }
    finally { setDispLoading(false); }
  };

  return (
    <div className="relative h-screen bg-[#0d1117] overflow-hidden">
      {(!isMapReady || points.length === 0) && (
        <div className="absolute inset-0 z-[2000] bg-[#0d1117] flex flex-col items-center justify-center pointer-events-none">
          <div className="size-16 border-4 border-[#1e2532] border-t-[#38b2ac] rounded-full animate-spin mb-4" />
          <div className="text-[13px] text-[#8b949e] font-medium tracking-tight animate-pulse">Initializing geospatial layers…</div>
        </div>
      )}

      <MapContainer
        center={[12.972, 77.594]}
        zoom={12}
        scrollWheelZoom
        zoomControl={false}
        preferCanvas
        className="absolute inset-0 w-full h-full bg-[#0d1117]"
        whenReady={() => setIsMapReady(true)}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" maxZoom={19} />
        <ImperativeMapLayers
          points={points}
          blindZones={blindZones}
          rawViolations={rawViolations}
          layers={layers}
          selected={selected}
          setSelected={(h) => { setSelected(h); setDrawerOpen(true); }}
          hourlyById={hourlyById}
          timeOn={timeOn}
          hour={hour}
          displacement={displacement}
        />
      </MapContainer>

      {/* Floating layer control */}
      <div className={cn(
        "absolute top-5 left-5 w-[280px] rounded-xl border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md shadow-2xl transition-all duration-300 overflow-hidden z-[1000]",
        layersOpen ? "max-h-[500px] p-5 pb-4" : "max-h-[64px] p-0",
      )}>
        <div
          className={cn("flex items-start justify-between cursor-pointer", !layersOpen && "px-5 py-4")}
          onClick={() => setLayersOpen(!layersOpen)}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-1">Map</div>
            <div className="font-medium text-[16px] text-[#e6eaf2] tracking-tight">Bengaluru · Urban Core</div>
          </div>
          <div className="flex gap-2">
            <button className="text-[#8b949e] hover:text-[#e6eaf2] transition-colors p-1" onClick={(e) => e.stopPropagation()}>
              <Search className="size-[18px]" />
            </button>
            <button className="text-[#8b949e] hover:text-[#e6eaf2] transition-colors p-1" aria-label="Toggle Layers">
              {layersOpen ? <ChevronUp className="size-[18px]" /> : <ChevronDown className="size-[18px]" />}
            </button>
          </div>
        </div>

        <div className={cn("transition-opacity duration-300", layersOpen ? "opacity-100" : "opacity-0 pointer-events-none hidden")}>
          <div className="mt-5 mb-3 text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold">Layers</div>
          <div className="space-y-3.5 mb-5">
            {layers.map((l) => (
              <label key={l.id} className="flex items-center gap-3 cursor-pointer group select-none">
                <input type="checkbox" className="hidden" checked={l.on} onChange={() => toggleLayer(l.id)} />
                <span
                  className={cn("size-4 rounded-full border-[1.5px] flex items-center justify-center transition-all", l.on ? "border-transparent" : "border-[#30363d]")}
                  style={{ background: l.on ? l.color : "transparent" }}
                >
                  {l.on && <span className="size-1.5 bg-[#0f141f] rounded-full shadow-sm" />}
                </span>
                <span className={cn("text-[13px] font-medium transition-colors", l.on ? "text-[#e6eaf2]" : "text-[#8b949e]")}>{l.label}</span>
                <span className="ml-auto text-[11px] text-[#8b949e] tabular-nums font-medium">
                  {counts[l.id] ? fmtCount(counts[l.id]) : "—"}
                </span>
              </label>
            ))}
          </div>
          <div className="pt-3 border-t border-[#1e2532]">
            <button
              onClick={(e) => { e.stopPropagation(); setLayers(initialLayers); }}
              className="text-[12px] text-[#8b949e] hover:text-[#e6eaf2] font-medium transition-colors"
            >
              Reset layers
            </button>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className={cn(
          "absolute top-5 right-5 w-[340px] rounded-xl border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md shadow-2xl flex flex-col transition-all duration-300 z-[1000]",
          drawerOpen ? "bottom-5" : "max-h-[72px]",
        )}>
          <div
            className={cn("px-5 py-4 flex items-start justify-between cursor-pointer", drawerOpen && "border-b border-[#1e2532]")}
            onClick={() => setDrawerOpen(!drawerOpen)}
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-1">Cluster</div>
              <div className="font-medium text-[18px] text-[#e6eaf2] tracking-tight flex gap-2 items-center">
                {selected.id}
                {!drawerOpen && <span className="text-[13px] text-[#8b949e] font-normal tracking-normal truncate max-w-[150px]">{selected.name}</span>}
              </div>
              {drawerOpen && <div className="text-[13px] text-[#8b949e] mt-0.5">{selected.name}</div>}
            </div>
            <div className="flex gap-1">
              <button className="text-[#8b949e] hover:text-[#e6eaf2] p-1 rounded-md transition-colors bg-transparent">
                {drawerOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSelected(null); }}
                className="text-[#8b949e] hover:text-[#ef4444] p-1 rounded-md transition-colors bg-transparent ml-1"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {drawerOpen && (
            <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300">
              <div className="px-5 py-5 border-b border-[#1e2532] grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-1">Violations</div>
                  <div className="text-[28px] font-light text-[#e6eaf2] tabular-nums tracking-tight">{selected.violations.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-1">Severity</div>
                  <div className="text-[28px] font-light tabular-nums tracking-tight" style={{ color: selected.intensity > 0.7 ? "#ef4444" : "#f5a623" }}>{Math.round(selected.intensity * 100)}</div>
                </div>
              </div>
              <div className="px-5 py-5 border-b border-[#1e2532]">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-3">Dominant Profile</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[13px]"><span className="text-[#8b949e]">Violation</span><span className="text-[#e6eaf2] font-medium">{selected.dominant_violation}</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-[#8b949e]">Peak Shift</span><span className="text-[#e6eaf2] font-medium">{selected.shift}</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-[#8b949e]">Road</span><span className="text-[#e6eaf2] font-medium">{selected.road_class}</span></div>
                </div>
              </div>

              {/* Spill-over / displacement */}
              <div className="px-5 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold">Displacement</div>
                  <button
                    onClick={displacement ? () => setDisplacement(null) : showDisplacement}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors",
                      displacement ? "border-[#f5a623]/50 text-[#f5a623]" : "border-[#1e2532] text-[#8b949e] hover:text-[#e6eaf2] hover:border-[#30363d]",
                    )}
                  >
                    <Share2 className="size-3" />
                    {dispLoading ? "…" : displacement ? "Hide flow" : "Trace flow"}
                  </button>
                </div>
                {displacement ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-[#8b949e] leading-relaxed mb-2">
                      If cleared, displaced demand re-routes to its neighbours (learned spill-over range ≈ {Math.round(displacement.sigma_m)} m):
                    </div>
                    {displacement.receivers.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-[12px]">
                        <span className="text-[#e6eaf2] flex-1 truncate">{r.name} <span className="text-[#8b949e]/60 text-[10px]">#{r.id}</span></span>
                        <span className="w-16 h-1 rounded-full bg-[#1e2532] overflow-hidden">
                          <span className="block h-full bg-[#f5a623]" style={{ width: `${(r.share / displacement.receivers[0].share) * 100}%` }} />
                        </span>
                        <span className="text-[#8b949e] tabular-nums w-9 text-right">{Math.round(r.share * 100)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#8b949e] leading-relaxed">
                    Trace where parking demand re-routes if this hotspot is enforced — avoids whack-a-mole displacement.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time Machine — hour-of-day scrubber */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[min(620px,calc(100vw-40px))] rounded-xl border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md shadow-2xl z-[1000] px-5 py-3.5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setTimeOn((v) => !v); setPlaying(false); }}
            className={cn(
              "flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors shrink-0",
              timeOn ? "border-[#38b2ac]/50 text-[#38b2ac] bg-[#38b2ac]/10" : "border-[#1e2532] text-[#8b949e] hover:text-[#e6eaf2]",
            )}
          >
            <Clock className="size-3.5" />
            Time Machine
          </button>

          {timeOn ? (
            <>
              <button
                onClick={() => setPlaying((p) => !p)}
                className="size-8 rounded-full bg-[#38b2ac] text-[#0d1117] grid place-items-center hover:bg-[#2c9a95] transition-colors shrink-0"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
              </button>

              {/* 24-bar intensity strip — click to scrub */}
              <div className="flex items-end gap-[2px] flex-1 h-9">
                {hourTotals.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => { setHour(i); setPlaying(false); }}
                    className="flex-1 rounded-sm transition-all hover:opacity-100"
                    style={{
                      height: `${20 + v * 80}%`,
                      background: heatColor(v),
                      opacity: i === hour ? 1 : 0.4,
                      outline: i === hour ? "1.5px solid #e6eaf2" : "none",
                    }}
                    title={`${String(i).padStart(2, "0")}:00`}
                  />
                ))}
              </div>

              <div className="text-right shrink-0 w-[68px]">
                <div className="font-display text-[20px] leading-none text-[#e6eaf2] tabular-nums">{String(hour).padStart(2, "0")}:00</div>
                <div className="text-[10px] text-[#8b949e] mt-1">{Math.round(hourTotals[hour] * 100)}% of peak</div>
              </div>
            </>
          ) : (
            <div className="text-[12px] text-[#8b949e] flex-1">
              Scrub the day to see how the hotspot heatmap shifts hour-by-hour — from historical violation timing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
