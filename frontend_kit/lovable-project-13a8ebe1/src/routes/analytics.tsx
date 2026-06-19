import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { peakHours } from "@/data/mock";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — ParkSight" },
      { name: "description", content: "Temporal heatmaps, repeat offenders, vehicle and station breakdowns." },
      { property: "og:title", content: "Analytics — ParkSight" },
      { property: "og:description", content: "When and who: parking-violation patterns." },
    ],
  }),
  component: Analytics,
});

const tabs = ["Temporal", "Violations", "Vehicles", "Stations", "Offenders"] as const;
type Tab = typeof tabs[number];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, i) => i);

function heatVal(d: number, h: number) {
  const base = peakHours[h] / 100;
  const dayWeight = [0.85, 0.9, 0.95, 1, 1.05, 0.7, 0.55][d];
  const noise = ((Math.sin(d * 7 + h * 1.3) + 1) / 2) * 0.25;
  return Math.min(1, base * dayWeight + noise * 0.4);
}

const violationTypes = [
  { name: "No-parking zone", count: 38420, pct: 33, tone: "critical" },
  { name: "Footpath obstruction", count: 24180, pct: 21, tone: "warning" },
  { name: "Double parking", count: 18960, pct: 16, tone: "warning" },
  { name: "Signal blocking", count: 14220, pct: 12, tone: "critical" },
  { name: "Bus-stop encroachment", count: 11220, pct: 10, tone: "info" },
  { name: "Other", count: 8350, pct: 8, tone: "info" },
];

const vehicles = [
  { name: "Two-wheeler", count: 52310, share: 45 },
  { name: "Sedan", count: 31230, share: 27 },
  { name: "SUV / MUV", count: 17880, share: 16 },
  { name: "Auto-rickshaw", count: 7820, share: 7 },
  { name: "LCV / truck", count: 6110, share: 5 },
];

const stations = [
  { name: "Cubbon Park PS", filed: 14820, cleared: 13110, rate: 88 },
  { name: "Halasuru Gate PS", filed: 12440, cleared: 10560, rate: 85 },
  { name: "Koramangala PS", filed: 11890, cleared: 9210, rate: 77 },
  { name: "Indiranagar PS", filed: 10210, cleared: 8740, rate: 86 },
  { name: "HSR Layout PS", filed: 9430, cleared: 7110, rate: 75 },
];

const offenders = [
  { plate: "KA01 AB 4321", count: 47, lastSeen: "MG Road", days: 28 },
  { plate: "KA05 MJ 9921", count: 39, lastSeen: "Koramangala", days: 14 },
  { plate: "KA51 PQ 0098", count: 33, lastSeen: "Indiranagar", days: 30 },
  { plate: "KA03 ZX 1144", count: 29, lastSeen: "Brigade Rd", days: 12 },
  { plate: "KA20 TT 7765", count: 26, lastSeen: "HSR Sec 1", days: 21 },
  { plate: "KA02 BB 5510", count: 24, lastSeen: "Church St", days: 9 },
];

function Analytics() {
  const [tab, setTab] = useState<Tab>("Temporal");

  return (
    <div className="px-6 lg:px-10 py-8 space-y-8 max-w-[1500px]">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-secondary">Patterns</div>
          <h1 className="mt-2 font-display text-[34px] leading-tight font-medium">
            Analytics <span className="text-text-secondary">— when & who</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-text-secondary">
          <span className="size-1.5 rounded-full bg-active" />
          Nov 2023 – Apr 2024 · 1,15,350 records
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-divider/40">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2.5 text-[12.5px] transition-colors ${
              tab === t ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t}
            {tab === t && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-command" />}
          </button>
        ))}
      </div>

      {tab === "Temporal" && (
        <section className="rounded-md border border-divider/50 bg-panel/20 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Temporal heatmap</div>
              <div className="text-[13px] text-text-primary mt-0.5">Violations by day-of-week × hour-of-day</div>
            </div>
            <div className="flex items-center gap-3 text-[10.5px] text-text-secondary">
              <span>low</span>
              <div className="h-2 w-24 rounded-sm" style={{ background: "linear-gradient(90deg, var(--color-info), var(--color-warning), var(--color-critical))" }} />
              <span>high</span>
            </div>
          </div>

          <div className="mt-6 grid" style={{ gridTemplateColumns: "auto repeat(24, minmax(0, 1fr))" }}>
            <div />
            {hours.map((h) => (
              <div key={h} className="text-[9.5px] text-text-secondary text-center tabular pb-1">
                {h % 3 === 0 ? h.toString().padStart(2, "0") : ""}
              </div>
            ))}
            {days.map((d, di) => (
              <Row key={d} day={d} di={di} />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 text-[12px]">
            <Insight title="Peak window" value="Tue · 15:00 – 17:00" sub="School pickup + commute" />
            <Insight title="Quietest" value="Sun · 03:00 – 05:00" sub="Use for survey patrols" />
            <Insight title="Weekend dip" value="-38%" sub="vs weekday average" />
          </div>
        </section>
      )}

      {tab === "Violations" && (
        <section className="rounded-md border border-divider/50 bg-panel/20 p-6">
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Violation mix</div>
          <ul className="mt-4 space-y-3">
            {violationTypes.map((v) => (
              <li key={v.name} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center">
                <div className="text-[13px] text-text-primary">{v.name}</div>
                <div className="text-[12.5px] text-text-secondary tabular">
                  {v.count.toLocaleString("en-IN")} <span className="text-text-secondary/60">· {v.pct}%</span>
                </div>
                <div className="col-span-2 h-1.5 rounded-sm bg-divider/30 overflow-hidden">
                  <div className="h-full" style={{ width: `${v.pct * 2.6}%`, background: `var(--color-${v.tone})` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "Vehicles" && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-md border border-divider/50 bg-panel/20 p-6">
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary mb-4">By vehicle class</div>
            <ul className="space-y-4">
              {vehicles.map((v) => (
                <li key={v.name}>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-text-primary">{v.name}</span>
                    <span className="tabular text-text-secondary">{v.count.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="mt-2 h-px bg-divider/30 relative">
                    <div className="absolute inset-y-[-2px] left-0 bg-command" style={{ width: `${v.share}%`, height: 4 }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-divider/50 bg-panel/20 p-6">
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Top class</div>
            <div className="mt-3 font-display text-[44px] font-light leading-none tabular">45<span className="text-lg text-text-secondary">%</span></div>
            <div className="mt-2 text-[13px] text-text-primary">Two-wheelers</div>
            <div className="mt-1 text-[12px] text-text-secondary">
              account for nearly half of all logged violations — concentrate footpath patrols.
            </div>
          </div>
        </section>
      )}

      {tab === "Stations" && (
        <section className="rounded-md border border-divider/50 bg-panel/20 overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead className="text-text-secondary text-[10.5px] uppercase tracking-[0.18em]">
              <tr className="border-b border-divider/40">
                <th className="text-left font-normal px-4 py-2.5">Station</th>
                <th className="text-right font-normal px-4 py-2.5">Filed</th>
                <th className="text-right font-normal px-4 py-2.5">Cleared</th>
                <th className="text-left font-normal px-4 py-2.5 w-[40%]">Clearance rate</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.name} className="border-b border-divider/20 hover:bg-panel/30">
                  <td className="px-4 py-3 text-text-primary">{s.name}</td>
                  <td className="px-4 py-3 text-right tabular text-text-secondary">{s.filed.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right tabular text-text-secondary">{s.cleared.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-sm bg-divider/30 overflow-hidden">
                        <div className="h-full bg-active" style={{ width: `${s.rate}%` }} />
                      </div>
                      <span className="tabular text-text-primary w-10 text-right">{s.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "Offenders" && (
        <section className="rounded-md border border-divider/50 bg-panel/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-divider/40 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">Repeat offenders</div>
              <div className="text-[13px] text-text-primary mt-0.5">≥20 violations · last 30 days</div>
            </div>
            <span className="text-[11px] text-text-secondary tabular">6 of 184</span>
          </div>
          <table className="w-full text-[12.5px]">
            <thead className="text-text-secondary text-[10.5px] uppercase tracking-[0.18em]">
              <tr className="border-b border-divider/40">
                <th className="text-left font-normal px-4 py-2.5">Plate</th>
                <th className="text-right font-normal px-4 py-2.5">Violations</th>
                <th className="text-left font-normal px-4 py-2.5">Last seen</th>
                <th className="text-right font-normal px-4 py-2.5">Window</th>
              </tr>
            </thead>
            <tbody>
              {offenders.map((o) => (
                <tr key={o.plate} className="border-b border-divider/20 hover:bg-panel/30">
                  <td className="px-4 py-3 font-display text-text-primary tabular">{o.plate}</td>
                  <td className="px-4 py-3 text-right tabular text-critical">{o.count}</td>
                  <td className="px-4 py-3 text-text-secondary">{o.lastSeen}</td>
                  <td className="px-4 py-3 text-right tabular text-text-secondary">{o.days} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Row({ day, di }: { day: string; di: number }) {
  return (
    <>
      <div className="text-[10.5px] text-text-secondary pr-2 self-center">{day}</div>
      {hours.map((h) => {
        const v = heatVal(di, h);
        const color = v > 0.7 ? "var(--color-critical)" : v > 0.45 ? "var(--color-warning)" : "var(--color-info)";
        return (
          <div key={h} className="aspect-square m-[1px] rounded-[2px]" style={{ background: color, opacity: 0.15 + v * 0.8 }} title={`${day} ${h}:00 · ${(v * 100).toFixed(0)}`} />
        );
      })}
    </>
  );
}

function Insight({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-divider/40 px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-text-secondary">{title}</div>
      <div className="mt-1 font-display text-[16px] text-text-primary">{value}</div>
      <div className="text-[11.5px] text-text-secondary mt-0.5">{sub}</div>
    </div>
  );
}