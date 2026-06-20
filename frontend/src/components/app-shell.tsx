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
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 min-w-0 h-screen">{children}</main>
      </div>
    </div>
  );
}