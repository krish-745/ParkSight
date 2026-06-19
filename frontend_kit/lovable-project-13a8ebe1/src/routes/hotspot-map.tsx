import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HeatMap } from "@/components/heat-map";
import { layers as initialLayers, peakHours, hotspots } from "@/data/mock";
import { Search, X } from "lucide-react";

export const Route = createFileRoute("/hotspot-map")({
  head: () => ({
    meta: [
      { title: "Hotspot Map — ParkSight" },
      { name: "description", content: "Interactive parking-violation hotspot map with hexbin congestion and blind-spot layers." },
      { property: "og:title", content: "Hotspot Map — ParkSight" },
      { property: "og:description", content: "Where violations cluster. Layered map for traffic-ops detection." },
    ],
  }),
  component: HotspotMapPage,
});

function HotspotMapPage() {
  const [layers, setLayers] = useState(initialLayers);
  const [selected, setSelected] = useState<typeof hotspots[number] | null>(hotspots[0]);

  const toggle = (id: string) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, on: !l.on } : l)));

  const showBlobs = layers.find((l) => l.id === "hexbin")?.on ?? true;
  const showDots = layers.find((l) => l.id === "violations")?.on ?? true;

  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
      <HeatMap className="absolute inset-0 w-full h-full" showBlobs={showBlobs} showDots={showDots} showLabels />

      {/* Floating layers */}
      <div className="absolute top-5 left-5 w-72 rounded-md border border-divider/60 bg-navy/85 backdrop-blur p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Map</div>
            <div className="font-display text-[15px] text-text-primary">Bengaluru · Urban Core</div>
          </div>
          <button className="text-text-secondary hover:text-text-primary">
            <Search className="size-4" />
          </button>
        </div>
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary mb-2">Layers</div>
        <div className="space-y-2">
          {layers.map((l) => (
            <label key={l.id} className="flex items-center gap-2.5 cursor-pointer group">
              <span
                className={`size-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                  l.on ? "border-transparent" : "border-divider"
                }`}
                style={{ background: l.on ? l.color : "transparent" }}
              >
                {l.on && <span className="size-1.5 bg-navy rounded-sm" />}
              </span>
              <span className={`text-[12.5px] ${l.on ? "text-text-primary" : "text-text-secondary"}`}>{l.label}</span>
              <span className="ml-auto text-[10.5px] text-text-secondary tabular">
                {l.id === "hotspots" ? "612" : l.id === "hexbin" ? "94" : l.id === "blind" ? "37" : "1.1k"}
              </span>
            </label>
          ))}
        </div>
        <button onClick={() => setLayers(initialLayers)} className="mt-4 text-[11px] text-text-secondary hover:text-text-primary">
          Reset layers
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-5 left-5 rounded-md border border-divider/60 bg-navy/85 backdrop-blur px-3 py-2 flex items-center gap-4 text-[10.5px] text-text-secondary">
        <span className="uppercase tracking-[0.2em]">Intensity</span>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-info" /> low
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" /> heavy
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-critical" /> critical
        </div>
      </div>

      {/* Clickable dots overlay */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
        {hotspots.filter((h) => h.intensity > 0.6).slice(0, 18).map((h) => (
          <circle
            key={h.id}
            cx={h.x}
            cy={h.y}
            r={1.6}
            fill="transparent"
            stroke="var(--color-warning)"
            strokeWidth="0.18"
            className="cursor-pointer hover:opacity-100"
            opacity={selected?.id === h.id ? 1 : 0.55}
            onClick={() => setSelected(h)}
          />
        ))}
      </svg>

      {/* Detail drawer */}
      {selected && (
        <div className="absolute top-5 right-5 bottom-5 w-[340px] rounded-md border border-divider/60 bg-navy/90 backdrop-blur flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-divider/40 flex items-start justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Cluster</div>
              <div className="font-display text-[16px] text-text-primary mt-0.5">{selected.id}</div>
              <div className="text-[11.5px] text-text-secondary mt-0.5">{selected.name}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-text-secondary hover:text-text-primary">
              <X className="size-4" />
            </button>
          </div>

          <div className="px-4 py-4 border-b border-divider/40 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Violations</div>
              <div className="font-display text-[28px] font-light text-text-primary tabular mt-1">
                {selected.violations.toLocaleString("en-IN")}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Severity</div>
              <div className="font-display text-[28px] font-light tabular mt-1" style={{ color: selected.intensity > 0.7 ? "var(--color-critical)" : "var(--color-warning)" }}>
                {Math.round(selected.intensity * 100)}
              </div>
            </div>
          </div>

          <div className="px-4 py-4 border-b border-divider/40">
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary mb-3">Hour-of-day</div>
            <div className="flex items-end gap-[3px] h-20">
              {peakHours.map((v, i) => (
                <div key={i} className="flex-1 bg-command/70 rounded-sm" style={{ height: `${v}%` }} />
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-text-secondary tabular">
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
          </div>

          <div className="px-4 py-4 flex-1 overflow-auto">
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary mb-2">Top streets</div>
            <ul className="space-y-2.5 text-[12.5px]">
              {["Brigade Road", "Church Street", "Residency Rd", "St Marks Rd", "Museum Rd"].map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="text-text-secondary tabular text-[11px] w-4">{i + 1}</span>
                  <span className="flex-1 text-text-primary">{s}</span>
                  <span className="text-text-secondary tabular">{(800 - i * 130)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-4 py-3 border-t border-divider/40 flex gap-2">
            <button className="flex-1 rounded-md bg-command text-white text-[12.5px] py-2 hover:bg-command/90">
              Dispatch patrol
            </button>
            <button className="rounded-md border border-divider/60 px-3 text-[12.5px] text-text-secondary hover:text-text-primary hover:border-command/60">
              Export
            </button>
          </div>
        </div>
      )}
    </div>
  );
}