'use client'

import { useMemo } from 'react'
import {
  CircleMarker,
  Circle,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip as LeafletTooltip,
} from 'react-leaflet'
import { heatColor, formatIN } from '@/lib/format'
import type { Hotspot, OptimizeResult } from '@/lib/types'

const CENTER: [number, number] = [12.97, 77.59]

function radiusForViolations(v: number, max: number): number {
  // size ∝ violations, gentle sqrt scale, px
  const t = Math.sqrt(v) / Math.sqrt(max)
  return 3 + t * 17
}

export default function HotspotMap({
  hotspots,
  optimize,
}: {
  hotspots: Hotspot[]
  optimize?: OptimizeResult | null
}) {
  const maxViolations = useMemo(
    () => Math.max(1, ...hotspots.map((h) => h.violations)),
    [hotspots],
  )

  return (
    <MapContainer
      center={CENTER}
      zoom={12}
      scrollWheelZoom
      className="size-full"
      preferCanvas
      zoomControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
        subdomains="abcd"
        maxZoom={20}
      />

      {hotspots.map((h) => {
        const color = heatColor(h.cii_normalized)
        return (
          <CircleMarker
            key={h.id}
            center={[h.lat, h.lon]}
            radius={radiusForViolations(h.violations, maxViolations)}
            pathOptions={{
              color,
              weight: 1,
              fillColor: color,
              fillOpacity: 0.55,
            }}
          >
            <LeafletTooltip direction="top" opacity={1} sticky>
              <span className="font-medium">{h.station}</span> ·{' '}
              {formatIN(h.violations)} violations
            </LeafletTooltip>
            <Popup>
              <div className="min-w-[200px] font-sans text-[13px]">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="font-semibold">{h.station}</span>
                  <span className="rounded bg-[#1c1f24] px-1.5 py-0.5 font-mono text-[11px] text-[#f5a623]">
                    #{h.rank}
                  </span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[#9ba1a8]">
                  <dt>Violations</dt>
                  <dd className="text-right font-mono tabular-nums text-[#e6e8eb]">
                    {formatIN(h.violations)}
                  </dd>
                  <dt>Dominant</dt>
                  <dd className="text-right text-[#e6e8eb]">
                    {h.dominant_violation}
                  </dd>
                  <dt>Vehicle</dt>
                  <dd className="text-right text-[#e6e8eb]">
                    {h.dominant_vehicle}
                  </dd>
                  <dt>Peak / shift</dt>
                  <dd className="text-right text-[#e6e8eb]">
                    {h.peak_hour}:00 · {h.shift.split(' ')[0]}
                  </dd>
                  <dt>Road</dt>
                  <dd className="text-right text-[#e6e8eb]">
                    {h.road_class} · {h.lanes} lanes
                  </dd>
                </dl>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {optimize?.plan.map((p) => (
        <Circle
          key={`cov-${p.rank}`}
          center={[p.lat, p.lon]}
          radius={optimize.cover_radius_m}
          pathOptions={{
            color: '#f5a623',
            weight: 1,
            fillColor: '#f5a623',
            fillOpacity: 0.08,
            dashArray: '4 4',
          }}
        />
      ))}

      {optimize?.plan.map((p) => (
        <CircleMarker
          key={`patrol-${p.rank}`}
          center={[p.lat, p.lon]}
          radius={13}
          pathOptions={{
            color: '#0b0c0e',
            weight: 2,
            fillColor: '#f5a623',
            fillOpacity: 1,
          }}
        >
          <LeafletTooltip
            permanent
            direction="center"
            className="patrol-label"
            opacity={1}
          >
            {p.rank}
          </LeafletTooltip>
          <Popup>
            <div className="min-w-[200px] font-sans text-[13px]">
              <div className="mb-1.5 font-semibold">
                Patrol {p.rank} · {p.station}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[#9ba1a8]">
                <dt>Covers</dt>
                <dd className="text-right font-mono text-[#e6e8eb]">
                  {p.hotspots_covered} hotspots
                </dd>
                <dt>Shift</dt>
                <dd className="text-right text-[#e6e8eb]">
                  {p.recommended_shift.split(' ')[0]}
                </dd>
                <dt>Impact</dt>
                <dd className="text-right font-mono text-[#f5a623]">
                  {p.impact_covered_pct}%
                </dd>
              </dl>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
