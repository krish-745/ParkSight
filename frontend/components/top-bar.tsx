import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

export function TopBar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1 text-muted-foreground" />
      <Separator orientation="vertical" className="h-5" />
      <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          Bengaluru
        </span>
        <Separator orientation="vertical" className="hidden h-4 sm:block" />
        <span className="tabular-nums">Nov 2023 – Apr 2024</span>
      </div>
    </header>
  )
}
