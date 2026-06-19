import { useEffect, useRef, useCallback, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import type { Hotspot, OptimizeResult } from "./api";
import { heatColor, formatIN } from "./api";

// ── Types ──

interface HotspotMapProps {
  hotspots: Hotspot[];
  optimize?: OptimizeResult | null;
  showHexbin?: boolean;
  onHotspotClick?: (h: Hotspot) => void;
}

// ── Hex grid overlay (canvas-based) ──

function drawHexGrid(
  map: L.Map,
  canvas: HTMLCanvasElement,
  hotspots: Hotspot[]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = map.getSize();
  canvas.width = size.x;
  canvas.height = size.y;
  ctx.clearRect(0, 0, size.x, size.y);

  const HEX_R = 18; // radius in pixels
  const cols = Math.ceil(size.x / (HEX_R * 1.732)) + 2;
  const rows = Math.ceil(size.y / (HEX_R * 1.5)) + 2;

  // bin hotspots into hex cells
  const bins = new Map<string, number>();
  for (const h of hotspots) {
    const pt = map.latLngToContainerPoint([h.lat, h.lon]);
    const col = Math.round(pt.x / (HEX_R * 1.732));
    const row = Math.round(pt.y / (HEX_R * 1.5));
    const key = `${col},${row}`;
    bins.set(key, (bins.get(key) ?? 0) + h.violations);
  }

  const maxBin = Math.max(1, ...bins.values());

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const x = c * HEX_R * 1.732 + (r % 2 === 0 ? 0 : HEX_R * 0.866);
      const y = r * HEX_R * 1.5;
      const key = `${c},${r}`;
      const val = bins.get(key) ?? 0;
      if (val === 0) continue;

      const intensity = Math.min(1, val / maxBin);
      const alpha = 0.15 + intensity * 0.6;

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + HEX_R * Math.cos(angle);
        const py = y + HEX_R * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // color by intensity: teal → orange → red
      const color = heatColor(intensity * 100);
      ctx.fillStyle =
        color.replace("rgb", "rgba").replace(")", `,${alpha})`);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}

// ── Imperative hotspot layer (performant for 600+ markers) ──

function ImperativeHotspots({
  hotspots,
  optimize,
  showHexbin,
  onHotspotClick,
}: HotspotMapProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const patrolLayerRef = useRef<L.LayerGroup | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [, setTick] = useState(0);

  // Create canvas overlay for hexbin
  useEffect(() => {
    const container = map.getContainer();
    let canvas = container.querySelector(
      ".hexbin-canvas"
    ) as HTMLCanvasElement | null;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "hexbin-canvas";
      canvas.style.cssText =
        "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:450;";
      container
        .querySelector(".leaflet-overlay-pane")
        ?.appendChild(canvas);
    }
    canvasRef.current = canvas;

    const redraw = () => {
      if (showHexbin && canvasRef.current) {
        drawHexGrid(map, canvasRef.current, hotspots);
      }
    };
    map.on("moveend zoomend resize", redraw);
    return () => {
      map.off("moveend zoomend resize", redraw);
    };
  }, [map, hotspots, showHexbin]);

  // Draw hexbin
  useEffect(() => {
    if (canvasRef.current) {
      if (showHexbin) {
        drawHexGrid(map, canvasRef.current, hotspots);
        canvasRef.current.style.display = "block";
      } else {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasRef.current.style.display = "none";
      }
    }
  }, [showHexbin, hotspots, map]);

  // Draw hotspot markers
  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }
    const group = L.layerGroup();
    const maxV = Math.max(1, ...hotspots.map((h) => h.violations));

    for (const h of hotspots) {
      const color = heatColor(h.cii_normalized);
      const radius = 3 + 17 * Math.sqrt(h.violations / maxV);

      const marker = L.circleMarker([h.lat, h.lon], {
        radius: showHexbin ? Math.max(2, radius * 0.4) : radius,
        color,
        fillColor: color,
        fillOpacity: showHexbin ? 0.3 : 0.5,
        weight: 1,
      });

      // Tooltip on hover
      marker.bindTooltip(
        `<b>${h.station}</b> · ${formatIN(h.violations)} violations`,
        { sticky: true, className: "dark-tooltip" }
      );

      // Popup on click (togglable — click opens, click again closes)
      const popupContent = `
        <div style="min-width: 220px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="background:${color};width:10px;height:10px;border-radius:50%;display:inline-block;"></span>
            <b style="font-size:14px;">#${h.rank} ${h.station}</b>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:12px;">
            <span style="color:#8b949e;">Violations</span><span>${formatIN(h.violations)}</span>
            <span style="color:#8b949e;">Type</span><span>${h.dominant_violation}</span>
            <span style="color:#8b949e;">Vehicle</span><span>${h.dominant_vehicle}</span>
            <span style="color:#8b949e;">Peak hour</span><span>${h.peak_hour}:00 IST</span>
            <span style="color:#8b949e;">Shift</span><span>${h.shift}</span>
            <span style="color:#8b949e;">Road</span><span>${h.road_class ?? "n/a"} · ${h.lanes ?? "?"} lanes</span>
            <span style="color:#8b949e;">CII</span><span>${h.cii_normalized.toFixed(1)}/100</span>
            <span style="color:#8b949e;">Junction</span><span>${h.junction_pct.toFixed(0)}%</span>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 300, closeOnClick: true });

      if (onHotspotClick) {
        marker.on("click", () => onHotspotClick(h));
      }

      group.addLayer(marker);
    }

    group.addTo(map);
    layerRef.current = group;
    setTick((t) => t + 1);

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [hotspots, map, showHexbin, onHotspotClick]);

  // Draw patrol overlay
  useEffect(() => {
    if (patrolLayerRef.current) {
      map.removeLayer(patrolLayerRef.current);
    }
    if (!optimize?.plan?.length) return;

    const group = L.layerGroup();

    for (const station of optimize.plan) {
      // Coverage circle (dashed)
      L.circle([station.lat, station.lon], {
        radius: optimize.cover_radius_m,
        color: "#f5a623",
        fillColor: "#f5a623",
        fillOpacity: 0.06,
        weight: 1.5,
        dashArray: "6, 4",
      }).addTo(group);

      // Patrol station marker
      const icon = L.divIcon({
        className: "patrol-icon",
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:#f5a623;border:2px solid #fff;
          display:grid;place-items:center;
          font-size:12px;font-weight:700;color:#000;
          box-shadow:0 0 12px rgba(245,166,35,0.5);
        ">${station.rank}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([station.lat, station.lon], { icon })
        .bindTooltip(
          `<b>Patrol #${station.rank}</b><br/>
          ${station.station}<br/>
          ${station.hotspots_covered} hotspots · ${station.impact_covered_pct}% impact<br/>
          ${station.recommended_shift}`,
          { sticky: false }
        )
        .addTo(group);
    }

    group.addTo(map);
    patrolLayerRef.current = group;

    return () => {
      if (patrolLayerRef.current) map.removeLayer(patrolLayerRef.current);
    };
  }, [optimize, map]);

  return null;
}

// ── Main Map Component ──

export default function HotspotMap({
  hotspots,
  optimize,
  showHexbin = false,
  onHotspotClick,
}: HotspotMapProps) {
  return (
    <MapContainer
      center={[12.972, 77.594]}
      zoom={12}
      scrollWheelZoom
      doubleClickZoom
      zoomControl
      preferCanvas
      style={{ height: "100%", width: "100%", borderRadius: "12px" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />
      <ImperativeHotspots
        hotspots={hotspots}
        optimize={optimize}
        showHexbin={showHexbin}
        onHotspotClick={onHotspotClick}
      />
    </MapContainer>
  );
}
