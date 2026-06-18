'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TopBar } from '@/components/top-bar'
import { KpiCards } from '@/components/kpi-cards'
import { PatrolOptimizer } from '@/components/patrol-optimizer'
import { CoverageCurveChart } from '@/components/coverage-curve-chart'
import { DeploymentPlanTable } from '@/components/deployment-plan-table'
import { STATIONS_LIST } from '@/lib/stations'
import {
  getCoverageCurve,
  getHotspots,
  getStats,
  optimizePatrols,
} from '@/lib/api'
import type { OptimizeResult } from '@/lib/types'

const HotspotMap = dynamic(() => import('@/components/hotspot-map'), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
})

export default function CommandPage() {
  const [patrols, setPatrols] = useState(15)
  const [radius, setRadius] = useState(1000)
  const [violation, setViolation] = useState('all')
  const [station, setStation] = useState('all')

  // debounced optimize inputs
  const [debounced, setDebounced] = useState({ patrols: 15, radius: 1000 })
  const [optimizing, setOptimizing] = useState(false)

  useEffect(() => {
    setOptimizing(true)
    const t = setTimeout(() => {
      setDebounced({ patrols, radius })
    }, 300)
    return () => clearTimeout(t)
  }, [patrols, radius])

  const { data: stats } = useSWR('stats', getStats)
  const { data: hotspots } = useSWR(['hotspots', violation, station], () =>
    getHotspots({ violation, station }),
  )
  const { data: coverage } = useSWR(['coverage', radius], () =>
    getCoverageCurve(25, debounced.radius),
  )

  const { data: optimize } = useSWR<OptimizeResult>(
    ['optimize', debounced.patrols, debounced.radius],
    () => optimizePatrols(debounced.patrols, debounced.radius),
    { keepPreviousData: true },
  )

  useEffect(() => {
    if (optimize) setOptimizing(false)
  }, [optimize])

  const visibleHotspots = useMemo(() => hotspots ?? [], [hotspots])

  return (
    <>
      <TopBar title="Command Center" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <KpiCards stats={stats} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Map */}
          <Card className="overflow-hidden p-0 lg:col-span-2">
            <div className="h-[420px] w-full sm:h-[520px]">
              <HotspotMap hotspots={visibleHotspots} optimize={optimize} />
            </div>
          </Card>

          {/* Optimizer rail */}
          <PatrolOptimizer
            patrols={patrols}
            radius={radius}
            onPatrols={setPatrols}
            onRadius={setRadius}
            result={optimize}
            loading={optimizing}
            stations={STATIONS_LIST}
            violation={violation}
            station={station}
            onViolation={setViolation}
            onStation={setStation}
          />
        </div>

        {/* Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Deployment intelligence</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curve">
              <TabsList>
                <TabsTrigger value="curve">Coverage curve</TabsTrigger>
                <TabsTrigger value="plan">Deployment plan</TabsTrigger>
              </TabsList>
              <TabsContent value="curve" className="pt-4">
                <CoverageCurveChart
                  data={coverage}
                  currentK={debounced.patrols}
                />
              </TabsContent>
              <TabsContent value="plan" className="pt-4">
                <DeploymentPlanTable
                  plan={optimize?.plan}
                  loading={optimizing}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
