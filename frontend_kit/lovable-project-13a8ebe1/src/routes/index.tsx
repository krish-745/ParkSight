import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { HeatMap } from "@/components/heat-map";
import { kpis, topHotspots } from "@/data/mock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — ParkSight" },
      { name: "description", content: "City-wide parking congestion overview, hotspots, fleet coverage, and headline insights." },
      { property: "og:title", content: "Overview — ParkSight" },
      { property: "og:description", content: "Parking congestion at a glance for the urban core." },
    ],
  }),
  component: Overview,
});

function Kpi({ label, value, suffix, foot, accent = "command" }: {
  label: string; value: string; suffix?: string; foot: React.ReactNode; accent?: "command" | "warning" | "active" | "info";
}) {
  const accentColor = `var(--color-${accent})`;
  return (
    <div className="relative px-5 py-5 min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary truncate">{label}</div>
      <div className="mt-3 flex items-baseline gap-1.5 min-w-0">
        <span className="font-display text-[clamp(24px,2.4vw,34px)] leading-none font-light tabular text-text-primary truncate">{value}</span>
        {suffix && <span className="text-text-secondary text-xs shrink-0">{suffix}</span>}
      </div>
      <div className="mt-3 text-[11.5px] text-text-secondary flex items-center gap-1.5 min-w-0">
        <span className="size-1 rounded-full" style={{ background: accentColor }} />
        <div className="min-w-0 flex-1">{foot}</div>
      </div>
    </div>
  );
}

function Overview() {
  return (
    <div className="px-6 lg:px-10 py-8 space-y-8 max-w-[1500px]">
      {/* Page heading */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-secondary">City Overview</div>
          <h1 className="mt-2 font-display text-[34px] leading-tight font-medium text-text-primary">
            Parking congestion <span className="text-text-secondary">at a glance</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-text-secondary">
          <span className="size-1.5 rounded-full bg-active" />
          Last refresh 14s ago · live
        </div>
      </div>

      {/* KPI bar — divided instrument strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-divider/40 border-y border-divider/40">
        <Kpi label="Hotspots" value="612" foot={<>DBSCAN clusters · +14 wk/wk</>} accent="warning" />
        <Kpi label="Violations analyzed" value="1,15,350" foot={<>approved records</>} accent="info" />
        <Kpi label="Recommended fleet" value="22" suffix="units" foot={<>optimal patrol allocation</>} accent="command" />
        <Kpi label="Achievable coverage" value="77" suffix="%" foot={
          <span className="flex-1 flex items-center gap-2">
            <span className="flex-1 h-px bg-divider/60 relative overflow-hidden">
              <span className="absolute inset-y-0 left-0 bg-active" style={{ width: "77%" }} />
            </span>
          </span>
        } accent="active" />
      </section>

      {/* Headline insight */}
      <section className="rounded-md border border-command/30 bg-command/5 px-5 py-4 flex items-center gap-5">
        <div className="size-9 rounded-md border border-command/40 grid place-items-center text-command">
          <TrendingUp className="size-4" />
        </div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-[0.2em] text-command/80">Headline insight</div>
          <div className="mt-0.5 text-[14.5px] text-text-primary">
            Just <span className="font-display font-medium">5 patrol units</span> rotating through the top clusters cover{" "}
            <span className="font-display font-medium text-active">~48% of all violations</span> — a 3.2× efficiency gain over uniform routing.
          </div>
        </div>
        {/* sparkline */}
        <svg viewBox="0 0 120 36" className="w-40 h-9 shrink-0">
          <polyline
            fill="none"
            stroke="var(--color-active)"
            strokeWidth="1.5"
            points="0,28 12,24 24,26 36,20 48,22 60,14 72,16 84,10 96,12 108,6 120,8"
          />
          <polyline
            fill="none"
            stroke="var(--color-divider)"
            strokeWidth="1"
            strokeDasharray="2 3"
            points="0,30 120,18"
          />
        </svg>
      </section>

      {/* Map + Top hotspots */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-md border border-divider/50 overflow-hidden bg-panel/30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-divider/40">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Mini map</div>
              <div className="text-[13px] text-text-primary mt-0.5">Citywide hotspot density</div>
            </div>
            <Link to="/hotspot-map" className="text-[12px] text-command hover:text-command/80 flex items-center gap-1">
              Open full map <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="aspect-[16/10] relative">
            <HeatMap className="absolute inset-0 w-full h-full" showLabels />
            <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10.5px] text-text-secondary bg-navy/70 border border-divider/40 rounded px-2 py-1">
              <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-critical" /> critical</span>
              <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warning" /> heavy</span>
              <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-info" /> watch</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-md border border-divider/50 bg-panel/30">
          <div className="px-4 py-3 border-b border-divider/40 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Top hotspots</div>
              <div className="text-[13px] text-text-primary mt-0.5">By violations · last 30 days</div>
            </div>
            <span className="text-[11px] text-text-secondary">5 of 612</span>
          </div>
          <ul className="divide-y divide-divider/30">
            {topHotspots.map((h) => (
              <li key={h.rank} className="px-4 py-3.5 flex items-center gap-4 hover:bg-panel/40">
                <div className="font-display text-text-secondary text-[12px] tabular w-5">
                  {h.rank.toString().padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] text-text-primary truncate">{h.name}</div>
                  <div className="text-[11px] text-text-secondary tabular mt-0.5">{h.violations.toLocaleString("en-IN")} violations</div>
                </div>
                <div className={`flex items-center gap-1 text-[11.5px] tabular ${h.trend >= 0 ? "text-critical" : "text-active"}`}>
                  {h.trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {Math.abs(h.trend)}%
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { to: "/hotspot-map", title: "Explore Hotspot Map", desc: "Layer hexbins, blind spots, and raw violations.", tag: "Detect" },
          { to: "/patrol-optimizer", title: "Run Patrol Optimizer", desc: "Pick fleet size, see coverage curve, export plan.", tag: "Act" },
          { to: "/analytics", title: "Open Analytics", desc: "Temporal heatmaps, repeat offenders, forecast.", tag: "When" },
        ].map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="group rounded-md border border-divider/50 bg-panel/20 px-4 py-4 hover:border-command/50 hover:bg-panel/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">{q.tag}</span>
              <ArrowUpRight className="size-3.5 text-text-secondary group-hover:text-command" />
            </div>
            <div className="mt-2 font-display text-[15px] text-text-primary">{q.title}</div>
            <div className="mt-1 text-[12px] text-text-secondary">{q.desc}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
