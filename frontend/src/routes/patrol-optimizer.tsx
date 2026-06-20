import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { hotspots } from "@/data/mock";
import { useLive, apiOptimize, apiCoverageCurve, apiRoute, apiGetHotspots, toGeoPoints, type OptimizeResult, type CoverageCurve, type RouteResp, type GeoPoint } from "@/data/api";
import { Download, Play, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Leaflet touches `window` at import time → load the map client-only via dynamic import.
const PatrolMapCanvas = lazy(() => import("@/components/patrol-map-canvas"));

export const Route = createFileRoute("/patrol-optimizer")({
  head: () => ({
    meta: [
      { title: "Patrol Optimizer — ParkSight" },
      { name: "description", content: "Pick fleet size and shift length, see live coverage on the city map." },
    ],
  }),
  component: PatrolOptimizer,
});

const k = 0.075;
const coverageAt = (n: number) => 1 - Math.exp(-k * n);

function PatrolOptimizer() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [fleet, setFleet] = useState(22);
  const [shift, setShift] = useState(8);
  const [planOpen, setPlanOpen] = useState(true);
  const [opt, setOpt] = useState<OptimizeResult | null>(null);
  const [routeData, setRouteData] = useState<RouteResp | null>(null);
  const curve = useLive<CoverageCurve | null>(() => apiCoverageCurve(50), null);
  const points = useLive<GeoPoint[]>(() => apiGetHotspots(600).then(toGeoPoints), []);

  const validOpt = opt?.num_patrols === fleet ? opt : null;

  // re-optimize (debounced) whenever fleet size changes; clear any drawn route
  useEffect(() => {
    let on = true;
    setRouteData(null);
    const t = setTimeout(() => { apiOptimize(fleet, 1000).then((r) => on && setOpt(r)).catch(() => {}); }, 400);
    return () => { on = false; clearTimeout(t); };
  }, [fleet]);

  // Shift length sets *temporal* coverage: a full 12h shift blankets the daily
  // risk window, a 4h shift leaves gaps. Fleet size sets *spatial* coverage
  // (how many hotspots you reach). The headline number is the product of both.
  const shiftFactor = 0.7 + (0.3 * (shift - 4)) / (12 - 4);
  const curveAt = (n: number) =>
    (curve && curve.optimized_pct[n - 1] != null ? curve.optimized_pct[n - 1] / 100 : coverageAt(n)) * shiftFactor;
  const coverage = validOpt ? (validOpt.total_coverage_pct / 100) * shiftFactor : curveAt(fleet);
  const baseline5 = curveAt(5);

  const plan = useMemo(() => {
    if (validOpt?.plan?.length) {
      return validOpt.plan.map((p, i) => {
        return {
          unit: `PU-${(i + 1).toString().padStart(2, "0")}`,
          h: { name: p.station },
          violations: p.hotspots_covered,
          km: p.impact_covered_pct.toFixed(1),
          eta: p.recommended_shift.split(" ")[0] ?? `${6 + (i % 4)} min`,
        };
      });
    }
    return [...hotspots].sort((a, b) => b.violations - a.violations).slice(0, fleet).map((h, i) => ({
      unit: `PU-${(i + 1).toString().padStart(2, "0")}`, h, violations: h.violations,
      km: (3 + (i % 7)).toFixed(1), eta: `${6 + (i % 4)} min`,
    }));
  }, [validOpt, fleet]);

  const downloadCsv = () => {
    const head = "unit,station,hotspots_covered,impact_pct,shift";
    const rows = plan.map((p) => `${p.unit},${p.h.name},${p.violations},${p.km},${p.eta}`);
    const blob = new Blob([head + "\n" + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "deployment_plan.csv"; a.click();
  };
  const [isComputing, setIsComputing] = useState(false);
  const computeRoute = () => { 
    setIsComputing(true);
    apiRoute(fleet, 1000).then(res => {
      setRouteData(res);
      setIsComputing(false);
    }).catch(() => { setIsComputing(false); }); 
  };

  // Coverage curve mini-svg
  const W = 260, H = 60;
  const svgPoints = Array.from({ length: 51 }, (_, i) => {
    const x = (i / 50) * W;
    const y = H - curveAt(i) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const cursorX = (fleet / 50) * W;
  const cursorY = H - coverage * H;

  const [isMapReady, setIsMapReady] = useState(false);

  return (
    <div className="relative h-screen overflow-hidden bg-[#0d1117]">
      {/* Loading Skeleton */}
      {(!isMapReady || points.length === 0) && (
        <div className="absolute inset-0 z-[2000] bg-[#0d1117] flex flex-col items-center justify-center pointer-events-none">
          <div className="size-16 border-4 border-[#1e2532] border-t-[#38b2ac] rounded-full animate-spin mb-4" />
          <div className="text-[13px] text-[#8b949e] font-medium tracking-tight animate-pulse">Initializing optimizer grid...</div>
        </div>
      )}

      {/* Full-bleed Leaflet Map (client-only) */}
      {mounted && (
        <Suspense fallback={null}>
          <PatrolMapCanvas
            points={points}
            opt={opt}
            routeData={routeData}
            onReady={() => setIsMapReady(true)}
          />
        </Suspense>
      )}

      {/* Top-left: controls panel */}
      <div className="absolute top-5 left-5 w-[340px] rounded-xl border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md p-5 shadow-2xl z-[1000]">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold">Operations</div>
            <div className="font-medium text-[16px] text-[#e6eaf2] tracking-tight mt-0.5">Patrol Optimizer</div>
          </div>
          <span className="text-[10px] text-[#8b949e] font-medium tabular-nums">Bengaluru · Urban Core</span>
        </div>

        <div className="mt-5">
          <SliderRow label="Fleet size" value={fleet} setValue={setFleet} min={1} max={50} unit="units" />
          <div className="h-4" />
          <SliderRow label="Shift length" value={shift} setValue={setShift} min={4} max={12} unit="hours" />
        </div>

        {/* Big coverage readout */}
        <div className="mt-6 pt-5 border-t border-[#1e2532]">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold">Projected coverage</div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-[44px] leading-none font-light tabular-nums text-[#e6eaf2]">{(coverage * 100).toFixed(0)}</span>
                <span className="text-[#8b949e] text-sm">%</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold">vs 5-unit baseline</div>
              <div className="mt-1.5 text-[18px] font-medium tabular-nums text-active">
                {((coverage - baseline5) * 100) > 0 ? '+' : ''}{((coverage - baseline5) * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* mini curve */}
          <svg viewBox={`0 0 ${W} ${H + 10}`} className="mt-4 w-full h-14">
            <polyline fill="var(--color-command)" fillOpacity="0.12" stroke="none" points={`0,${H} ${svgPoints} ${W},${H}`} />
            <polyline fill="none" stroke="var(--color-command)" strokeWidth="1.5" points={svgPoints} />
            <line x1={cursorX} x2={cursorX} y1={0} y2={H} stroke="var(--color-active)" strokeOpacity="0.5" strokeWidth="1" />
            <circle cx={cursorX} cy={cursorY} r="3" fill="var(--color-active)" />
          </svg>
          <div className="flex justify-between text-[10px] text-[#8b949e] font-medium tabular-nums mt-1">
            <span>0 units</span><span>25</span><span>50</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={computeRoute} disabled={isComputing || fleet > 50} className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-[#38b2ac] hover:bg-[#319795] text-[#0d1117] font-semibold text-[13px] py-2 transition-colors shadow-sm disabled:opacity-50">
            {isComputing ? (
              <span className="animate-pulse">Computing...</span>
            ) : fleet > 50 ? (
              <><Play className="size-3.5" /> Max 50 units for routing</>
            ) : (
              <><Play className="size-3.5" /> {routeData ? `Route · ${routeData.total_distance_km.toFixed(0)} km` : "Compute route"}</>
            )}
          </button>
          <button onClick={downloadCsv} className="flex items-center justify-center gap-1.5 rounded-md border border-[#30363d] bg-[#161b22] px-4 text-[13px] text-[#e6eaf2] font-medium hover:bg-[#21262d] transition-colors shadow-sm">
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Bottom-left legend */}
      <div className="absolute bottom-5 left-5 rounded-md border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md px-4 py-2.5 flex items-center gap-5 text-[11px] text-[#8b949e] font-medium z-[1000] shadow-xl">
        <span className="uppercase tracking-[0.2em] font-semibold">Markers</span>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--color-command)]" /> patrol unit
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full border border-[var(--color-command)] opacity-80" /> coverage radius
        </div>
      </div>

      {/* Right: deployment plan drawer */}
      {planOpen ? (
        <div className="absolute top-5 right-5 bottom-5 w-[360px] rounded-xl border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300 z-[1000]">
          <div className="px-5 py-4 border-b border-[#1e2532] flex items-start justify-between bg-[#161b22]/40">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-1">Deployment plan</div>
              <div className="font-medium text-[16px] text-[#e6eaf2] tracking-tight">{fleet} units · sorted by yield</div>
            </div>
            <button onClick={() => setPlanOpen(false)} className="text-[#8b949e] hover:text-[#e6eaf2] p-1 rounded-md transition-colors bg-[#161b22]">
              <Minimize2 className="size-4" />
            </button>
          </div>

          <div className="px-5 py-4 border-b border-[#1e2532] grid grid-cols-4 gap-3">
            <Mini label="Total km" value={plan.reduce((a, p) => a + parseFloat(p.km), 0).toFixed(0)} />
            <Mini label="Unit-Hrs" value={(fleet * shift).toString()} />
            <Mini label="Avg ETA" value="7 min" />
            <Mini label="Marginal +1" value={`+${Math.max(0, (curveAt(fleet + 1) - coverage) * 100).toFixed(2)}%`} tone="info" />
          </div>

          <div className="flex-1 overflow-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <table className="w-full text-[13px]">
              <thead className="text-[#8b949e] text-[10px] uppercase tracking-[0.2em] font-semibold sticky top-0 bg-[#0f141f]/95 backdrop-blur-sm shadow-sm z-10">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Unit</th>
                  <th className="text-left px-2 py-3 font-semibold">Area</th>
                  <th className="text-right px-2 py-3 font-semibold">Viol.</th>
                  <th className="text-right px-5 py-3 font-semibold">ETA</th>
                </tr>
              </thead>
              <tbody className="text-[#e6eaf2] font-medium">
                {plan.map((p) => (
                  <tr key={p.unit} className="border-b border-[#1e2532]/50 hover:bg-[#161b22] transition-colors">
                    <td className="px-5 py-3 tabular-nums text-[12px]">{p.unit}</td>
                    <td className="px-2 py-3 truncate max-w-[140px] text-[13px]">{p.h.name}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-[#8b949e] text-[13px]">{p.violations}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#8b949e] text-[13px]">{p.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setPlanOpen(true)}
          className="absolute top-5 right-5 rounded-xl border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md px-4 py-2.5 text-[13px] font-medium text-[#8b949e] hover:text-[#e6eaf2] transition-colors shadow-xl flex items-center gap-2 z-[1000]"
        >
          <Maximize2 className="size-4" /> Show plan
        </button>
      )}
    </div>
  );
}

function SliderRow({ label, value, setValue, min, max, unit }: {
  label: string; value: number; setValue: (v: number) => void; min: number; max: number; unit: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold">{label}</div>
        <div className="text-[15px] font-medium tabular-nums text-[#e6eaf2]">
          {value} <span className="text-[11px] text-[#8b949e] font-normal">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full h-1.5 bg-[#1e2532] rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#38b2ac] [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-[#319795] transition-all"
        style={{
          background: `linear-gradient(to right, #38b2ac 0%, #38b2ac ${((value - min) / (max - min)) * 100}%, #1e2532 ${((value - min) / (max - min)) * 100}%, #1e2532 100%)`
        }}
      />
    </div>
  );
}

function Mini({ label, value, tone = "text" }: { label: string; value: string; tone?: "text" | "info" }) {
  const color = tone === "info" ? "text-[#58a6ff]" : "text-[#e6eaf2]";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#8b949e] font-semibold">{label}</div>
      <div className={`mt-1 text-[18px] font-medium tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

void X;