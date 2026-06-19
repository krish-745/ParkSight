'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { RouteResult } from '@/lib/types'

export default function PatrolRouteLayer({ route }: { route: RouteResult }) {
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    // Clear previous route layer
    if (layerRef.current) {
      layerRef.current.remove()
    }

    const group = L.layerGroup().addTo(map)
    layerRef.current = group

    // Animated polyline
    const latlngs = route.polyline.map((c) => [c[0], c[1]] as [number, number])
    const routeLine = L.polyline(latlngs, {
      color: '#3FB6A8',
      weight: 3.5,
      opacity: 0.9,
      dashArray: '10 10',
      lineCap: 'round',
    }).addTo(group)

    // Animate dash
    const el = routeLine.getElement?.()
    if (el) {
      el.style.animation = 'route-dash 1.5s linear infinite'
    }

    // Numbered stop markers
    route.stops.forEach((s) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:50%;background:#3FB6A8;border:2px solid #0A0A0B;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0A0A0B;font-family:Inter,sans-serif;box-shadow:0 0 8px rgba(63,182,168,0.5)">${s.order}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      L.marker([s.lat, s.lon], { icon, zIndexOffset: 1000 })
        .bindPopup(
          `<b>Stop #${s.order} · ${s.station}</b><br>Covers ${s.hotspots_covered} hotspots · ${s.recommended_shift}<br>Next leg: ${s.dist_to_next_km} km · ~${s.time_to_next_min} min`,
        )
        .addTo(group)
    })

    // Fit bounds
    try {
      map.fitBounds(routeLine.getBounds().pad(0.15))
    } catch (_) {}

    return () => {
      group.remove()
    }
  }, [map, route])

  return null
}
