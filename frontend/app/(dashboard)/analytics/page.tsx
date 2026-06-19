'use client'

import useSWR from 'swr'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TopBar } from '@/components/top-bar'
import { TemporalHeatmap } from '@/components/temporal-heatmap'
import { BreakdownBarChart } from '@/components/breakdown-bar-chart'
import { BlindSpotsPanel } from '@/components/blind-spots-panel'
import { RouteOptimizerPanel } from '@/components/route-optimizer-panel'
import {
  getBreakdown,
  getBlindSpots,
  getHotspots,
  getStationBreakdown,
  getTemporal,
} from '@/lib/api'

export default function AnalyticsPage() {
  const { data: temporal } = useSWR('temporal', getTemporal)
  const { data: breakdown } = useSWR('breakdown', getBreakdown)
  const { data: stations } = useSWR('station-breakdown', getStationBreakdown)
  const { data: blindSpots, isLoading: blindSpotsLoading } = useSWR(
    'blindspots',
    () => getBlindSpots(30),
  )
  const { data: hotspots } = useSWR('hotspots-all', () => getHotspots({ limit: 600 }))

  return (
    <>
      <TopBar title="Analytics" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="temporal">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="temporal">Temporal</TabsTrigger>
                <TabsTrigger value="violations">Violations</TabsTrigger>
                <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                <TabsTrigger value="stations">Stations</TabsTrigger>
                <TabsTrigger value="blindspots">Blind Spots</TabsTrigger>
                <TabsTrigger value="route">Patrol Route</TabsTrigger>
              </TabsList>

              <TabsContent value="temporal" className="pt-6">
                <div className="mb-4 flex flex-col gap-1">
                  <h2 className="text-sm font-semibold">
                    Violations by day &amp; hour (IST)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    7 days × 24 hours · color encodes violation count.
                  </p>
                </div>
                <TemporalHeatmap data={temporal} />
              </TabsContent>

              <TabsContent value="violations" className="pt-6">
                <div className="mb-4 flex flex-col gap-1">
                  <h2 className="text-sm font-semibold">
                    Violations by type
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Wrong parking and no parking dominate enforcement volume.
                  </p>
                </div>
                <BreakdownBarChart items={breakdown?.violation_types} />
              </TabsContent>

              <TabsContent value="vehicles" className="pt-6">
                <div className="mb-4 flex flex-col gap-1">
                  <h2 className="text-sm font-semibold">
                    Violations by vehicle type
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Cars and scooters account for the majority of offenders.
                  </p>
                </div>
                <BreakdownBarChart items={breakdown?.vehicle_types} />
              </TabsContent>

              <TabsContent value="stations" className="pt-6">
                <div className="mb-4 flex flex-col gap-1">
                  <h2 className="text-sm font-semibold">
                    Violations by police station
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Ranked by total congestion-weighted violations in
                    jurisdiction.
                  </p>
                </div>
                <BreakdownBarChart items={stations} />
              </TabsContent>

              <TabsContent value="blindspots" className="pt-6">
                <div className="mb-4 flex flex-col gap-1">
                  <h2 className="text-sm font-semibold">
                    Enforcement Blind Spots
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Zones with high congestion impact but low enforcement activity — the areas
                    being missed today.
                  </p>
                </div>
                <BlindSpotsPanel data={blindSpots} loading={blindSpotsLoading} />
              </TabsContent>

              <TabsContent value="route" className="pt-6">
                <div className="mb-4 flex flex-col gap-1">
                  <h2 className="text-sm font-semibold">
                    Patrol Route Optimizer
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    TSP-optimal driving circuit through selected patrol stations ·
                    road-snapped via OSRM when available.
                  </p>
                </div>
                <RouteOptimizerPanel hotspots={hotspots} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How to read this</CardTitle>
            <CardDescription>
              Temporal patterns drive shift assignment; violation and vehicle
              mix inform enforcement tactics; station ranking guides resourcing.
              Blind spots reveal where enforcement should be, not just where it
              is. The patrol route turns deployment dots into an actionable
              driving circuit.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  )
}
