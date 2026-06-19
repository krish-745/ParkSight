import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HeatMap } from "@/components/heat-map";
import { hotspots } from "@/data/mock";
import { Download, Play, Maximize2, Minimize2, X } from "lucide-react";

export const Route = createFileRoute("/patrol-optimizer")({
  head: () => ({
    meta: [
      { title: "Patrol Optimizer — ParkSight" },
      { name: "description", content: "Pick fleet size and shift length, see live coverage on the city map." },
      { property: "og:title", content: "Patrol Optimizer — ParkSight" },
      { property: "og:description", content: "Live coverage math for patrol fleet allocation." },
    ],
  }),
  component: PatrolOptimizer,
});

const k = 0.075;
const coverageAt = (n: number) => 1 - Math.exp(-k * n);

function PatrolOptimizer() {
  const [fleet, setFleet] = useState(22);
  const [shift, setShift] = useState(8);
  const [planOpen, setPlanOpen] = useState(true);

  const coverage = coverageAt(fleet);
  const baseline5 = coverageAt(5);

  const plan = useMemo(
    () =>
      [...hotspots]
        .sort((a, b) => b.violations - a.violations)
        .slice(0, fleet)
        .map((h, i) => ({
          unit: `PU-${(i + 1).toString().padStart(2, "0")}`,
          h,
          violations: h.violations,
          km: (3 + (i % 7)).toFixed(1),
          eta: `${6 + (i % 4)} min`,
        })),
    [fleet]
  );

  // Coverage curve mini-svg
  const W = 260, H = 60;
  const points = Array.from({ length: 61 }, (_, i) => {
    const x = (i / 60) * W;
    const y = H - coverageAt(i) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const cursorX = (fleet / 60) * W;
  const cursorY = H - coverage * H;

  return (
    <div className="relative h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Full-bleed map */}
      <HeatMap className="absolute inset-0 w-full h-full" showBlobs showDots={false} showLabels />

      {/* Deployment markers overlay */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full pointer-events-none">
        {plan.map((p, i) => (
          <g key={p.unit}>
            <circle cx={p.h.x} cy={p.h.y} r={4.5} fill="var(--color-command)" fillOpacity="0.1" stroke="var(--color-command)" strokeOpacity="0.55" strokeWidth="0.18" />
            <circle cx={p.h.x} cy={p.h.y} r={1} fill="var(--color-command)" />
            {i < 12 && (
              <text x={p.h.x + 1.4} y={p.h.y + 0.6} fontSize="1.5" fill="var(--color-text-primary)" fontFamily="var(--font-display)">
                {p.unit}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Top-left: controls panel */}
      <div className="absolute top-5 left-5 w-[340px] rounded-md border border-divider/60 bg-navy/85 backdrop-blur p-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Operations</div>
            <div className="font-display text-[15px] text-text-primary mt-0.5">Patrol Optimizer</div>
          </div>
          <span className="text-[10.5px] text-text-secondary tabular">Bengaluru · Urban Core</span>
        </div>

        <div className="mt-4">
          <SliderRow label="Fleet size" value={fleet} setValue={setFleet} min={1} max={60} unit="units" />
          <div className="h-3" />
          <SliderRow label="Shift length" value={shift} setValue={setShift} min={4} max={12} unit="hours" />
        </div>

        {/* Big coverage readout */}
        <div className="mt-5 pt-4 border-t border-divider/40">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Projected coverage</div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-display text-[44px] leading-none font-light tabular text-text-primary">{(coverage * 100).toFixed(0)}</span>
                <span className="text-text-secondary text-sm">%</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">vs 5-unit baseline</div>
              <div className="mt-1.5 font-display text-[18px] tabular text-active">+{((coverage - baseline5) * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* mini curve */}
          <svg viewBox={`0 0 ${W} ${H + 10}`} className="mt-3 w-full h-14">
            <polyline fill="var(--color-command)" fillOpacity="0.12" stroke="none" points={`0,${H} ${points} ${W},${H}`} />
            <polyline fill="none" stroke="var(--color-command)" strokeWidth="1.2" points={points} />
            <line x1={cursorX} x2={cursorX} y1={0} y2={H} stroke="var(--color-active)" strokeOpacity="0.5" strokeWidth="0.6" />
            <circle cx={cursorX} cy={cursorY} r="2.6" fill="var(--color-active)" />
          </svg>
          <div className="flex justify-between text-[10px] text-text-secondary tabular">
            <span>0 units</span><span>30</span><span>60</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-command text-white text-[12px] py-2 hover:bg-command/90">
            <Play className="size-3.5" /> Compute route
          </button>
          <button className="flex items-center justify-center gap-1.5 rounded-md border border-divider/60 px-3 text-[12px] text-text-secondary hover:text-text-primary hover:border-command/60">
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Bottom-left legend */}
      <div className="absolute bottom-5 left-5 rounded-md border border-divider/60 bg-navy/85 backdrop-blur px-3 py-2 flex items-center gap-4 text-[10.5px] text-text-secondary">
        <span className="uppercase tracking-[0.2em]">Markers</span>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-command" /> patrol unit
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border border-command/60 bg-command/10" /> coverage radius
        </div>
      </div>

      {/* Right: deployment plan drawer */}
      {planOpen ? (
        <div className="absolute top-5 right-5 bottom-5 w-[360px] rounded-md border border-divider/60 bg-navy/90 backdrop-blur flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-divider/40 flex items-start justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Deployment plan</div>
              <div className="font-display text-[15px] text-text-primary mt-0.5">{fleet} units · sorted by yield</div>
            </div>
            <button onClick={() => setPlanOpen(false)} className="text-text-secondary hover:text-text-primary">
              <Minimize2 className="size-4" />
            </button>
          </div>

          <div className="px-4 py-3 border-b border-divider/40 grid grid-cols-3 gap-3 text-[11px]">
            <Mini label="Total km" value={plan.reduce((a, p) => a + parseFloat(p.km), 0).toFixed(0)} />
            <Mini label="Avg ETA" value="7 min" />
            <Mini label="Marginal +1" value={`+${((coverageAt(fleet + 1) - coverage) * 100).toFixed(2)}%`} tone="info" />
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-[12px]">
              <thead className="text-text-secondary text-[10px] uppercase tracking-[0.18em] sticky top-0 bg-navy/95">
                <tr className="border-b border-divider/40">
                  <th className="text-left font-normal px-3 py-2">Unit</th>
                  <th className="text-left font-normal px-3 py-2">Area</th>
                  <th className="text-right font-normal px-3 py-2">Viol.</th>
                  <th className="text-right font-normal px-3 py-2">ETA</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((p) => (
                  <tr key={p.unit} className="border-b border-divider/20 hover:bg-panel/30">
                    <td className="px-3 py-2 font-display text-text-primary tabular">{p.unit}</td>
                    <td className="px-3 py-2 text-text-primary truncate max-w-[140px]">{p.h.name}</td>
                    <td className="px-3 py-2 text-right tabular text-text-secondary">{p.violations}</td>
                    <td className="px-3 py-2 text-right tabular text-text-secondary">{p.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setPlanOpen(true)}
          className="absolute top-5 right-5 rounded-md border border-divider/60 bg-navy/85 backdrop-blur px-3 py-2 text-[12px] text-text-secondary hover:text-text-primary flex items-center gap-2"
        >
          <Maximize2 className="size-3.5" /> Show plan
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
      <div className="flex items-baseline justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">{label}</div>
        <div className="font-display text-[15px] tabular text-text-primary">
          {value} <span className="text-[10.5px] text-text-secondary">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mt-2 w-full accent-command"
      />
    </div>
  );
}

function Mini({ label, value, tone = "text" }: { label: string; value: string; tone?: "text" | "info" }) {
  const color = tone === "info" ? "text-info" : "text-text-primary";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">{label}</div>
      <div className={`mt-1 font-display text-[15px] tabular ${color}`}>{value}</div>
    </div>
  );
}

// Keep import used to avoid lint warning if drawer collapsed
void X;