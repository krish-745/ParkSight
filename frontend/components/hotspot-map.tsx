'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { heatColor, formatIN } from '@/lib/format'
import type { Hotspot, OptimizeResult } from '@/lib/types'

const CENTER: [number, number] = [12.97, 77.59]

function radiusForViolations(v: number, max: number): number {
  const t = Math.sqrt(v) / Math.sqrt(max)
  return 3 + t * 17
}

function ImperativeHotspots({ hotspots, optimize }: { hotspots: Hotspot[], optimize?: OptimizeResult | null }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !hotspots || hotspots.length === 0) return

    const layerGroup = L.layerGroup().addTo(map)
    const maxViolations = Math.max(1, ...hotspots.map((h) => h.violations))

    // 1. Draw all hotspots
    hotspots.forEach((h) => {
      const color = heatColor(h.cii_normalized)
      const r = radiusForViolations(h.violations, maxViolations)
      
      const marker = L.circleMarker([h.lat, h.lon], {
        radius: r,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.55,
      })

      marker.bindTooltip(`
        <div style="font-family: inherit;">
          <span style="font-weight: 500;">${h.station}</span> &middot; ${formatIN(h.violations)} violations
        </div>
      `, { direction: 'top', sticky: true })

      marker.bindPopup(`
        <div class="min-w-[200px] font-sans text-[13px]">
          <div class="mb-1.5 flex items-center justify-between gap-3">
            <span class="font-semibold">${h.station}</span>
            <span class="rounded bg-[#1c1f24] px-1.5 py-0.5 font-mono text-[11px] text-[#f5a623]">
              #${h.rank}
            </span>
          </div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[#9ba1a8]">
            <dt>Violations</dt>
            <dd class="text-right font-mono tabular-nums text-[#e6e8eb]">${formatIN(h.violations)}</dd>
            <dt>Dominant</dt>
            <dd class="text-right text-[#e6e8eb]">${h.dominant_violation}</dd>
            <dt>Vehicle</dt>
            <dd class="text-right text-[#e6e8eb]">${h.dominant_vehicle}</dd>
            <dt>Peak / shift</dt>
            <dd class="text-right text-[#e6e8eb]">${h.peak_hour}:00 &middot; ${h.shift.split(' ')[0]}</dd>
            <dt>Road</dt>
            <dd class="text-right text-[#e6e8eb]">${h.road_class} &middot; ${h.lanes} lanes</dd>
          </dl>
        </div>
      `)

      layerGroup.addLayer(marker)
    })

    // 2. Draw optimizer layers if present
    if (optimize?.plan) {
      optimize.plan.forEach((p) => {
        // Coverage circle
        L.circle([p.lat, p.lon], {
          radius: optimize.cover_radius_m,
          color: '#f5a623',
          weight: 1,
          fillColor: '#f5a623',
          fillOpacity: 0.08,
          dashArray: '4 4',
        }).addTo(layerGroup)

        // Patrol station marker
        const patrolMarker = L.circleMarker([p.lat, p.lon], {
          radius: 13,
          color: '#0b0c0e',
          weight: 2,
          fillColor: '#f5a623',
          fillOpacity: 1,
        })

        patrolMarker.bindTooltip(`${p.rank}`, {
          permanent: true,
          direction: 'center',
          className: 'patrol-label',
          opacity: 1
        })

        patrolMarker.bindPopup(`
          <div class="min-w-[200px] font-sans text-[13px]">
            <div class="mb-1.5 font-semibold">
              Patrol ${p.rank} &middot; ${p.station}
            </div>
            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[#9ba1a8]">
              <dt>Covers</dt>
              <dd class="text-right font-mono text-[#e6e8eb]">${p.hotspots_covered} hotspots</dd>
              <dt>Shift</dt>
              <dd class="text-right text-[#e6e8eb]">${p.recommended_shift.split(' ')[0]}</dd>
              <dt>Impact</dt>
              <dd class="text-right font-mono text-[#f5a623]">${p.impact_covered_pct}%</dd>
            </dl>
          </div>
        `)

        layerGroup.addLayer(patrolMarker)
      })
    }

    return () => {
      map.removeLayer(layerGroup)
    }
  }, [map, hotspots, optimize])

  return null
}

export default function HotspotMap({
  hotspots,
  optimize,
}: {
  hotspots: Hotspot[]
  optimize?: OptimizeResult | null
}) {
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
      <ImperativeHotspots hotspots={hotspots} optimize={optimize} />
    </MapContainer>
  )
}
