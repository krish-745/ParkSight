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
import {
  getBreakdown,
  getStationBreakdown,
  getTemporal,
} from '@/lib/api'

export default function AnalyticsPage() {
  const { data: temporal } = useSWR('temporal', getTemporal)
  const { data: breakdown } = useSWR('breakdown', getBreakdown)
  const { data: stations } = useSWR('station-breakdown', getStationBreakdown)

  return (
    <>
      <TopBar title="Analytics" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="temporal">
              <TabsList>
                <TabsTrigger value="temporal">Temporal</TabsTrigger>
                <TabsTrigger value="violations">Violations</TabsTrigger>
                <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                <TabsTrigger value="stations">Stations</TabsTrigger>
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
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How to read this</CardTitle>
            <CardDescription>
              Temporal patterns drive shift assignment; violation and vehicle
              mix inform enforcement tactics; station ranking guides resourcing.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  )
}
