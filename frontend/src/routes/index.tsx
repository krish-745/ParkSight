import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { MiniMap } from "@/components/mini-map";
import { topHotspots as topHotspotsMock } from "@/data/mock";
import { useLive, apiGetStats, apiGetHotspots, apiCoverageCurve, toTopHotspots, toGeoPoints, type Stats, type GeoPoint, type CoverageCurve } from "@/data/api";

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
  const stats = useLive<Stats | null>(apiGetStats, null);
  const mapPts = useLive<GeoPoint[]>(() => apiGetHotspots(600).then(toGeoPoints), []);
  const top = useLive(() => apiGetHotspots(5).then(toTopHotspots), topHotspotsMock);
  const curve = useLive<CoverageCurve | null>(() => apiCoverageCurve(40), null);
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const covPct = stats?.coverage_at_recommended_pct ?? 77;

  // Real headline numbers, derived from the live coverage curve (k = 5 units).
  const cov5 = curve && curve.optimized_pct.length >= 5 ? curve.optimized_pct[4] : null;
  const even5 = curve && curve.even_pct.length >= 5 ? curve.even_pct[4] : null;
  const gain = cov5 != null && even5 != null && even5 > 0 ? cov5 / even5 : null;

  // Real sparkline: the optimized impact-coverage curve (diminishing returns).
  const sparkPts = (() => {
    if (!curve || !curve.optimized_pct.length) return null;
    const ys = curve.optimized_pct;
    const max = Math.max(...ys, 1);
    const n = ys.length;
    return ys.map((v, i) => `${(i / (n - 1)) * 120},${(36 - (v / max) * 32).toFixed(1)}`).join(" ");
  })();
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
          {stats ? "Live · connected" : "Connecting…"}
        </div>
      </div>

      {/* KPI bar — divided instrument strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-divider/40 border-y border-divider/40">
        <Kpi label="Hotspots" value={stats ? fmt(stats.total_hotspots) : "612"} foot={<>DBSCAN clusters · approved records</>} accent="warning" />
        <Kpi label="Violations analyzed" value={stats ? fmt(stats.total_violations) : "1,15,350"} foot={<>approved records</>} accent="info" />
        <Kpi label="Recommended fleet" value={stats ? String(stats.recommended_fleet) : "22"} suffix="units" foot={<>optimal patrol allocation</>} accent="command" />
        <Kpi label="Achievable coverage" value={stats ? String(stats.coverage_at_recommended_pct) : "77"} suffix="%" foot={
          <span className="flex-1 flex items-center gap-2">
            <span className="flex-1 h-px bg-divider/60 relative overflow-hidden">
              <span className="absolute inset-y-0 left-0 bg-active" style={{ width: `${covPct}%` }} />
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
            {cov5 != null ? (
              <>
                Just <span className="font-display font-medium">5 patrol units</span> rotating through the top clusters cover{" "}
                <span className="font-display font-medium text-active">~{Math.round(cov5)}% of all impact</span>
                {gain != null && gain >= 1.1 ? <> — a {gain.toFixed(1)}× efficiency gain over uniform routing.</> : <>.</>}
              </>
            ) : (
              <>A small, optimally-placed patrol fleet covers a disproportionate share of total congestion impact.</>
            )}
          </div>
        </div>
        {/* sparkline — real optimized coverage curve (diminishing returns) */}
        <svg viewBox="0 0 120 36" className="w-40 h-9 shrink-0">
          {sparkPts && (
            <polyline fill="none" stroke="var(--color-active)" strokeWidth="1.5" points={sparkPts} />
          )}
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
            <MiniMap points={mapPts} className="absolute inset-0 w-full h-full" />
            <div className="absolute bottom-3 left-3 z-[500] flex items-center gap-3 text-[10.5px] text-text-secondary bg-navy/70 border border-divider/40 rounded px-2 py-1">
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
              <div className="text-[13px] text-text-primary mt-0.5">By violation volume</div>
            </div>
            <span className="text-[11px] text-text-secondary">5 of {stats ? fmt(stats.total_hotspots) : "—"}</span>
          </div>
          <ul className="divide-y divide-divider/30">
            {(() => {
              const maxV = Math.max(1, ...top.map((h) => h.violations));
              return top.map((h) => (
                <li key={h.rank} className="px-4 py-3.5 flex items-center gap-4 hover:bg-panel/40">
                  <div className="font-display text-text-secondary text-[12px] tabular w-5">
                    {h.rank.toString().padStart(2, "0")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-text-primary truncate">{h.name}</div>
                    <div className="text-[11px] text-text-secondary tabular mt-0.5">{h.violations.toLocaleString("en-IN")} violations</div>
                  </div>
                  {/* share-of-top bar — real, not a fabricated trend % */}
                  <div className="w-16 h-1 rounded-full bg-divider/40 overflow-hidden shrink-0">
                    <div className="h-full rounded-full bg-warning" style={{ width: `${(h.violations / maxV) * 100}%` }} />
                  </div>
                </li>
              ));
            })()}
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
