'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PatrolPlanItem } from '@/lib/types'

type SortKey = keyof Pick<
  PatrolPlanItem,
  'rank' | 'station' | 'hotspots_covered' | 'impact_covered_pct'
>

export function DeploymentPlanTable({
  plan,
  loading,
}: {
  plan?: PatrolPlanItem[]
  loading?: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [asc, setAsc] = useState(true)

  if (loading && !plan) return <Skeleton className="h-[280px] w-full" />
  if (!plan || plan.length === 0)
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Adjust the optimizer to generate a deployment plan.
      </p>
    )

  const sorted = [...plan].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
    return asc ? cmp : -cmp
  })

  const toggle = (key: SortKey) => {
    if (key === sortKey) setAsc(!asc)
    else {
      setSortKey(key)
      setAsc(true)
    }
  }

  const downloadCsv = () => {
    const header = [
      'Rank',
      'Station',
      'Road class',
      'Lanes',
      'Hotspots covered',
      'Shift',
      'Impact %',
      'Lat',
      'Lon',
    ]
    const rows = plan.map((p) => [
      p.rank,
      p.station,
      p.road_class,
      p.lanes,
      p.hotspots_covered,
      p.recommended_shift,
      p.impact_covered_pct,
      p.lat,
      p.lon,
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `parksight-deployment-${plan.length}-patrols.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ChevronsUpDown className="ml-1 inline size-3 text-dim" />
    ) : asc ? (
      <ArrowUp className="ml-1 inline size-3 text-primary" />
    ) : (
      <ArrowDown className="ml-1 inline size-3 text-primary" />
    )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {plan.length} patrol units · ranked by impact
        </p>
        <Button size="sm" onClick={downloadCsv}>
          <Download data-icon="inline-start" />
          Download CSV
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="w-14 cursor-pointer select-none"
                onClick={() => toggle('rank')}
              >
                Rank
                <SortIcon k="rank" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggle('station')}
              >
                Station
                <SortIcon k="station" />
              </TableHead>
              <TableHead>Road</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => toggle('hotspots_covered')}
              >
                Covered
                <SortIcon k="hotspots_covered" />
              </TableHead>
              <TableHead>Shift</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => toggle('impact_covered_pct')}
              >
                Impact
                <SortIcon k="impact_covered_pct" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => (
              <TableRow key={p.rank}>
                <TableCell className="font-mono tabular-nums text-muted-foreground">
                  {p.rank}
                </TableCell>
                <TableCell className="font-medium">{p.station}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.road_class} · {p.lanes}L
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {p.hotspots_covered}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {p.recommended_shift.split(' ')[0]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-primary">
                  {p.impact_covered_pct}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
