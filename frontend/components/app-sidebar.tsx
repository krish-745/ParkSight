'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutGrid, BarChart3 } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const NAV = [
  { title: 'Command Center', href: '/command', icon: LayoutGrid },
  { title: 'Analytics', href: '/analytics', icon: BarChart3 },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1.5 py-2.5">
          <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <span className="text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            ParkSight
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarMenu>
            {NAV.map((item) => {
              const active = pathname === item.href
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary data-[active=true]:font-medium"
                    render={
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground group-data-[collapsible=icon]:hidden">
          <div className="font-medium text-foreground">Bengaluru Traffic Police</div>
          <div className="text-dim">Parking Enforcement Cell</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
