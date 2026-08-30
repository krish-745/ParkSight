// Client-only Leaflet canvas for the patrol optimizer.
// Loaded via dynamic import (see patrol-optimizer.tsx) so Leaflet never runs during SSR.
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { OptimizeResult, RouteResp, GeoPoint, MultiRouteResp } from "@/data/api";
import "leaflet/dist/leaflet.css";

function ImperativeOptimizerMap({
  points, opt, routeData, multiRouteData, selectedCarIds,
}: {
  points: GeoPoint[];
  opt: OptimizeResult | null;
  routeData: RouteResp | null;
  multiRouteData: MultiRouteResp | null;
  selectedCarIds?: number[];
}) {
  const map = useMap();
  const backgroundLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const patrolLayer = useRef<L.LayerGroup | null>(null);

  // Background dots (dim)
  useEffect(() => {
    if (backgroundLayer.current) map.removeLayer(backgroundLayer.current);
    const group = L.layerGroup();

    for (const h of points) {
      let color = "#38b2ac";
      if (h.intensity > 0.7) color = "#ef4444";
      else if (h.intensity > 0.4) color = "#f5a623";

      L.circleMarker([h.lat, h.lon], {
        radius: 2,
        color: color,
        fillColor: color,
        fillOpacity: 0.2,
        opacity: 0.1,
        weight: 1,
        interactive: false,
      }).addTo(group);
    }

    group.addTo(map);
    backgroundLayer.current = group;
    return () => { if (backgroundLayer.current) map.removeLayer(backgroundLayer.current); };
  }, [points, map]);

  // Route Polyline(s): multi-route takes priority over legacy single route
  useEffect(() => {
    if (routeLayer.current) map.removeLayer(routeLayer.current);
    const group = L.layerGroup();

    if (multiRouteData?.cars?.length) {
      const allBounds: [number, number][] = [];
      
      // Filter cars to show based on selectedCarIds (if provided)
      const visibleCars = selectedCarIds
        ? multiRouteData.cars.filter(car => selectedCarIds.includes(car.car_id))
        : multiRouteData.cars;

      visibleCars.forEach((car) => {
        const color = car.color;

        // Draw route polyline
        if (car.polyline.length > 1) {
          L.polyline(car.polyline as [number, number][], {
            color,
            weight: 3,
            opacity: 0.85,
            dashArray: "8, 6",
            interactive: false,
          }).addTo(group);
        }

        // Numbered stop markers
        car.stops.forEach((stop) => {
          allBounds.push([stop.lat, stop.lon]);
          const icon = L.divIcon({
            className: "",
            html: `<div style="
              width:28px;height:28px;border-radius:50%;
              background:${color};border:2px solid #fff;
              display:grid;place-items:center;
              font-size:11px;font-weight:700;color:#000;
              box-shadow:0 0 10px rgba(0,0,0,0.4);
            ">${stop.order}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          L.marker([stop.lat, stop.lon], { icon, interactive: false })
            .bindTooltip(`PU-${String(car.car_id).padStart(2,"0")} · Stop ${stop.order}<br/>${stop.station}`, { sticky: true })
            .addTo(group);
        });
      });

      if (allBounds.length) map.fitBounds(allBounds, { padding: [50, 50] });

    } else if (routeData) {
      // Legacy single-route fallback
      const polyline = L.polyline(routeData.polyline as [number, number][], {
        color: "var(--color-active, #58a6ff)",
        weight: 3,
        opacity: 0.85,
        dashArray: "8, 6",
        interactive: false,
      }).addTo(group);
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }

    group.addTo(map);
    routeLayer.current = group;
    return () => { if (routeLayer.current) map.removeLayer(routeLayer.current); };
  }, [routeData, multiRouteData, selectedCarIds, map]);

  // Patrol Markers (from optimize result — shown before route is computed)
  useEffect(() => {
    if (patrolLayer.current) map.removeLayer(patrolLayer.current);
    if (!opt?.plan?.length) return;

    const group = L.layerGroup();

    opt.plan.forEach((p, i) => {
      // Coverage circle
      L.circle([p.lat, p.lon], {
        radius: opt.cover_radius_m,
        color: "var(--color-command, #f5a623)",
        fillColor: "var(--color-command, #f5a623)",
        fillOpacity: 0.08,
        weight: 1,
        dashArray: "4, 4",
        interactive: false,
      }).addTo(group);

      // Marker
      const unitStr = `PU-${(i + 1).toString().padStart(2, "0")}`;
      const icon = L.divIcon({
        className: "patrol-icon",
        html: `<div style="
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--color-command, #f5a623); border: 2px solid #fff;
          display: grid; place-items: center;
          font-size: 10px; font-weight: 700; color: #000;
          box-shadow: 0 0 12px rgba(245,166,35,0.4);
        ">${unitStr}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([p.lat, p.lon], { icon, interactive: false }).addTo(group);
    });

    group.addTo(map);
    patrolLayer.current = group;
    return () => { if (patrolLayer.current) map.removeLayer(patrolLayer.current); };
  }, [opt, map]);

  return null;
}

export default function PatrolMapCanvas({
  points, opt, routeData, multiRouteData, selectedCarIds, onReady,
}: {
  points: GeoPoint[];
  opt: OptimizeResult | null;
  routeData: RouteResp | null;
  multiRouteData: MultiRouteResp | null;
  selectedCarIds?: number[];
  onReady: () => void;
}) {
  return (
    <MapContainer
      center={[12.972, 77.594]}
      zoom={12}
      scrollWheelZoom
      zoomControl={false}
      className="absolute inset-0 w-full h-full bg-[#0d1117]"
      whenReady={onReady}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" maxZoom={19} />
      <ImperativeOptimizerMap points={points} opt={opt} routeData={routeData} multiRouteData={multiRouteData} selectedCarIds={selectedCarIds} />
    </MapContainer>
  );
}


