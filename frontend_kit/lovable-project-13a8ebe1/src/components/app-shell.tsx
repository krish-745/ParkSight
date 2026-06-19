import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Map, Route as RouteIcon, BarChart3, Bell, ChevronDown } from "lucide-react";
import { region } from "@/data/mock";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/hotspot-map", label: "Hotspot Map", icon: Map },
  { to: "/patrol-optimizer", label: "Patrol Optimizer", icon: RouteIcon },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full bg-canvas text-text-primary">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-divider/60 bg-navy">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="size-7 rounded-md bg-command grid place-items-center">
            <div className="size-2.5 rounded-sm bg-white" />
          </div>
          <div className="font-display text-[15px] font-semibold tracking-tight">
            ParkSight
          </div>
        </div>

        <div className="px-3 mt-2 text-[10px] uppercase tracking-[0.18em] text-text-secondary/70 mb-1.5">
          Workspace
        </div>

        <nav className="px-2 flex flex-col gap-0.5">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] transition-colors ${
                  active
                    ? "bg-panel/60 text-text-primary"
                    : "text-text-secondary hover:bg-panel/40 hover:text-text-primary"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-command" />
                )}
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-4 py-4 border-t border-divider/40">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-secondary/70">Status</div>
          <div className="mt-2 flex items-center gap-2 text-[12.5px]">
            <span className="size-1.5 rounded-full bg-active animate-pulse" />
            <span className="text-text-primary">All feeds nominal</span>
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">3 cameras offline</div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 shrink-0 border-b border-divider/60 bg-navy/40 backdrop-blur flex items-center px-5 gap-4">
          <button className="group flex items-center gap-2 rounded-md border border-divider/60 px-3 py-1.5 text-[12.5px] hover:border-command/60">
            <span className="size-1.5 rounded-full bg-info" />
            <span className="text-text-primary">{region.name}</span>
            <ChevronDown className="size-3.5 text-text-secondary" />
          </button>

          <div className="hidden md:flex items-center gap-2 rounded-md border border-divider/60 px-3 py-1.5 text-[12.5px] text-text-secondary">
            <span className="text-text-primary">{region.range}</span>
            <ChevronDown className="size-3.5" />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button className="relative rounded-md p-2 text-text-secondary hover:bg-panel/40 hover:text-text-primary">
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-critical" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-divider/60">
              <div className="size-7 rounded-full bg-gradient-to-br from-command to-info grid place-items-center text-[11px] font-semibold">
                AG
              </div>
              <div className="hidden lg:flex flex-col leading-tight">
                <span className="text-[12.5px] text-text-primary">Officer A. Gowda</span>
                <span className="text-[10.5px] text-text-secondary">Traffic Ops · Shift B</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}