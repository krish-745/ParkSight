'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { heatColor, formatIN } from '@/lib/format'
import type { RouteResult, Hotspot } from '@/lib/types'
import PatrolRouteLayer from './patrol-route-layer'

const CENTER: [number, number] = [12.97, 77.59]

function ImperativeHotspots({ hotspots }: { hotspots: Hotspot[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !hotspots || hotspots.length === 0) return

    const layerGroup = L.layerGroup().addTo(map)
    const maxViolations = Math.max(1, ...hotspots.map((h) => h.violations))

    hotspots.forEach((h) => {
      const color = heatColor(h.cii_normalized)
      const r = 3 + 17 * Math.sqrt(h.violations / maxViolations)
      
      const marker = L.circleMarker([h.lat, h.lon], {
        radius: r,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.40,
      })

      marker.bindPopup(`
        <div class="font-sans text-[13px]">
          <div class="font-semibold mb-1">#${h.rank} &middot; ${h.station}</div>
          <div class="text-[#9ba1a8]">${h.dominant_violation}</div>
          <div class="text-[#9ba1a8]">${formatIN(h.violations)} violations &middot; peak ${h.peak_hour}:00</div>
        </div>
      `)

      layerGroup.addLayer(marker)
    })

    return () => {
      map.removeLayer(layerGroup)
    }
  }, [map, hotspots])

  return null
}

export default function PatrolRouteMap({
  hotspots = [],
  route,
}: {
  hotspots?: Hotspot[]
  route?: RouteResult | null
}) {
  return (
    <>
      <style>{`@keyframes route-dash { to { stroke-dashoffset: -30; } }`}</style>
      <MapContainer
        center={CENTER}
        zoom={12}
        scrollWheelZoom
        className="size-full"
        preferCanvas={false}
        zoomControl
        style={{ background: '#0A0A0B' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
          subdomains="abcd"
          maxZoom={20}
        />
        
        <ImperativeHotspots hotspots={hotspots} />

        {/* route overlay (imperative Leaflet layer) */}
        {route && <PatrolRouteLayer route={route} />}
      </MapContainer>
    </>
  )
}
