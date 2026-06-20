import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  useLive, apiGetHotspots, apiGetBlindspots, apiGetViolations,
  apiGetHotspotHourly, apiGetDisplacement, toGeoPoints,
} from "@/data/api";
import type { GeoPoint, BlindSpot, RawViolation, HotspotHourly, DisplacementResp } from "@/data/api";
import { Search, X, ChevronDown, ChevronUp, Play, Pause, Clock, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { heatColor } from "@/lib/heat";

// Leaflet touches `window` at import time, so the map is split into a client-only
// module loaded via dynamic import — the server never evaluates Leaflet.
const HotspotMapCanvas = lazy(() => import("@/components/hotspot-map-canvas"));

export const Route = createFileRoute("/hotspot-map")({
  head: () => ({
    meta: [
      { title: "Hotspot Map — ParkSight" },
      { name: "description", content: "Interactive parking-violation hotspot map with hexbin congestion, blind-spot and raw-violation layers." },
    ],
  }),
  component: HotspotMapPage,
});

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

  // client-only mount gate (so the Leaflet chunk is never imported during SSR)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  const handleSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    const query = window.prompt("Enter cluster ID (e.g. H-102) or station name:");
    if (!query) return;
    const match = points.find(p => p.id.toLowerCase() === query.toLowerCase() || p.name.toLowerCase().includes(query.toLowerCase()));
    if (match) {
      setSelected(match);
      setDrawerOpen(true);
    } else {
      window.alert("No cluster found matching: " + query);
    }
  };

  // clear any displacement overlay when the selected hotspot changes
  useEffect(() => { setDisplacement(null); }, [selected]);

  const showDisplacement = async () => {
    if (!selected) return;
    const numId = Number(selected.id.replace("H-", ""));
    setDispLoading(true);
    try { setDisplacement(await apiGetDisplacement(numId, 4)); }
    finally { setDispLoading(false); }
  };

  // the full-height drawer (open + selected) is the only thing that reaches the
  // bottom-right, so the Time Machine only needs to dodge it in that case.
  const drawerBlocksBottom = !!selected && drawerOpen;

  return (
    <div className="relative h-screen bg-[#0d1117] overflow-hidden">
      {(!isMapReady || points.length === 0) && (
        <div className="absolute inset-0 z-[2000] bg-[#0d1117] flex flex-col items-center justify-center pointer-events-none">
          <div className="size-16 border-4 border-[#1e2532] border-t-[#38b2ac] rounded-full animate-spin mb-4" />
          <div className="text-[13px] text-[#8b949e] font-medium tracking-tight animate-pulse">Initializing geospatial layers…</div>
        </div>
      )}

      {mounted && (
        <Suspense fallback={null}>
          <HotspotMapCanvas
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
            onReady={() => setIsMapReady(true)}
          />
        </Suspense>
      )}

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
            <button className="text-[#8b949e] hover:text-[#e6eaf2] transition-colors p-1" onClick={handleSearch}>
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
            <div className="flex flex-col flex-1 overflow-y-auto animate-in fade-in duration-300">
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

      {/* Time Machine — hour-of-day scrubber. Confined to the area left of the
          detail drawer so it never slides under the right-hand card. */}
      <div
        className="absolute bottom-5 left-5 z-[1000] transition-[right] duration-300"
        style={{ right: drawerBlocksBottom ? 372 : 20 }}
      >
        <div className="mx-auto w-full max-w-[620px] rounded-xl border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md shadow-2xl px-5 py-3.5">
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
    </div>
  );
}
