import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { useLive, apiGetHotspots, toGeoPoints } from "@/data/api";
import type { GeoPoint } from "@/data/api";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Make sure to import leaflet CSS globally or here
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/hotspot-map")({
  head: () => ({
    meta: [
      { title: "Hotspot Map — ParkSight" },
      { name: "description", content: "Interactive parking-violation hotspot map with hexbin congestion and blind-spot layers." },
    ],
  }),
  component: HotspotMapPage,
});

function ImperativeMapLayers({
  points,
  layers,
  selected,
  setSelected,
}: {
  points: GeoPoint[];
  layers: { id: string; on: boolean }[];
  selected: GeoPoint | null;
  setSelected: (h: GeoPoint | null) => void;
}) {
  const map = useMap();
  const markersRef = useRef<L.LayerGroup | null>(null);
  const hexLayerRef = useRef<L.LayerGroup | null>(null);

  const showHexbin = layers.find((l) => l.id === "hexbin")?.on ?? false;
  const showDots = layers.find((l) => l.id === "hotspots")?.on ?? true;

  // Trigger re-renders on map movement to recalculate the hex grid
  const [mapHash, setMapHash] = useState(0);
  useEffect(() => {
    const redraw = () => setMapHash(h => h + 1);
    map.on("moveend zoomend resize", redraw);
    return () => { map.off("moveend zoomend resize", redraw); };
  }, [map]);

  // Hexbin Polygons (Rendered as individual cluster shapes to align perfectly with backend DBSCAN)
  useEffect(() => {
    if (hexLayerRef.current) {
      map.removeLayer(hexLayerRef.current);
      hexLayerRef.current = null;
    }

    if (!showHexbin || points.length === 0) return;

    const group = L.layerGroup();
    const zoom = map.getZoom();

    for (const h of points) {
      const pt = map.project([h.lat, h.lon], zoom);
      
      const intensity = h.intensity;
      const alpha = 0.2 + intensity * 0.6;
      // Dynamically size the hexagon based on intensity/violations
      const hexRadius = 12 + 28 * intensity;

      const latlngs: L.LatLngExpression[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = pt.x + hexRadius * Math.cos(angle);
        const py = pt.y + hexRadius * Math.sin(angle);
        latlngs.push(map.unproject([px, py], zoom));
      }

      let colorStr = "#38b2ac"; // teal
      if (intensity > 0.7) colorStr = "#ef4444"; // red
      else if (intensity > 0.4) colorStr = "#f5a623"; // orange

      const polygon = L.polygon(latlngs, {
        color: selected?.id === h.id ? "#ffffff" : colorStr,
        weight: selected?.id === h.id ? 2 : 1,
        opacity: selected?.id === h.id ? 1 : alpha * 0.4,
        fillColor: colorStr,
        fillOpacity: alpha * 0.85,
        interactive: true 
      });

      polygon.on("click", () => setSelected(h));
      group.addLayer(polygon);
    }

    group.addTo(map);
    hexLayerRef.current = group;

    return () => {
      if (hexLayerRef.current) {
        map.removeLayer(hexLayerRef.current);
        hexLayerRef.current = null;
      }
    };
  }, [map, points, showHexbin, mapHash, selected, setSelected]);

  // Dots / Clusters
  useEffect(() => {
    if (markersRef.current) {
      map.removeLayer(markersRef.current);
    }
    
    if (!showDots) return;

    const group = L.layerGroup();
    const maxV = Math.max(1, ...points.map((h) => h.violations));

    for (const h of points) {
      const radius = 3 + 12 * Math.sqrt(h.violations / maxV);
      let color = "#38b2ac"; // teal
      if (h.intensity > 0.7) color = "#ef4444"; // red
      else if (h.intensity > 0.4) color = "#f5a623"; // orange

      const marker = L.circleMarker([h.lat, h.lon], {
        radius,
        color: selected?.id === h.id ? "#ffffff" : color,
        fillColor: color,
        fillOpacity: 0.7,
        weight: selected?.id === h.id ? 2 : 1,
      });

      marker.on("click", () => {
        setSelected(h);
      });

      group.addLayer(marker);
    }

    group.addTo(map);
    markersRef.current = group;

    return () => {
      if (markersRef.current) map.removeLayer(markersRef.current);
    };
  }, [points, map, showDots, selected, setSelected]);

  return null;
}

const initialLayers = [
  { id: "hotspots", label: "Hotspot clusters", color: "#f5a623", on: true },
  { id: "hexbin", label: "Hexbin congestion", color: "#ef4444", on: false },
  { id: "blind", label: "Blind spots", color: "#8b949e", on: false },
  { id: "violations", label: "Raw violations", color: "#38b2ac", on: false },
];

function HotspotMapPage() {
  const points = useLive<GeoPoint[]>(() => apiGetHotspots(600).then(toGeoPoints), []);
  const [layers, setLayers] = useState(initialLayers);
  const [selected, setSelected] = useState<GeoPoint | null>(null);
  
  // Layer Control Toggle
  const [layersOpen, setLayersOpen] = useState(true);
  
  // Drawer Toggle
  const [drawerOpen, setDrawerOpen] = useState(true);

  const [isMapReady, setIsMapReady] = useState(false);

  // Focus effect for demo
  const auto = useRef(false);
  useEffect(() => {
    if (!auto.current && points.length) { setSelected(points[0]); auto.current = true; }
  }, [points]);

  const toggleLayer = (id: string) => {
    setLayers(ls => ls.map(l => l.id === id ? { ...l, on: !l.on } : l));
  };

  return (
    <div className="relative h-screen bg-[#0d1117] overflow-hidden">
      
      {/* Loading Skeleton */}
      {(!isMapReady || points.length === 0) && (
        <div className="absolute inset-0 z-[2000] bg-[#0d1117] flex flex-col items-center justify-center pointer-events-none">
          <div className="size-16 border-4 border-[#1e2532] border-t-[#38b2ac] rounded-full animate-spin mb-4" />
          <div className="text-[13px] text-[#8b949e] font-medium tracking-tight animate-pulse">Initializing geospatial layers...</div>
        </div>
      )}

      {/* 1. Leaflet Interactive Map */}
      <MapContainer
        center={[12.972, 77.594]}
        zoom={12}
        scrollWheelZoom
        zoomControl={false}
        className="absolute inset-0 w-full h-full bg-[#0d1117]"
        whenReady={() => setIsMapReady(true)}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        <ImperativeMapLayers 
          points={points} 
          layers={layers} 
          selected={selected} 
          setSelected={(h) => { setSelected(h); setDrawerOpen(true); }} 
        />
      </MapContainer>

      {/* 2. Floating Layer Control (Collapsible) - matches screenshot exactly */}
      <div className={cn(
        "absolute top-5 left-5 w-[280px] rounded-xl border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md shadow-2xl transition-all duration-300 overflow-hidden z-[1000]",
        layersOpen ? "max-h-[500px] p-5 pb-4" : "max-h-[64px] p-0"
      )}>
        {/* Header - Always visible, acts as toggle */}
        <div 
          className={cn(
            "flex items-start justify-between cursor-pointer",
            !layersOpen && "px-5 py-4"
          )}
          onClick={() => setLayersOpen(!layersOpen)}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-1">Map</div>
            <div className="font-medium text-[16px] text-[#e6eaf2] tracking-tight">Bengaluru · Urban Core</div>
          </div>
          <div className="flex gap-2">
            <button className="text-[#8b949e] hover:text-[#e6eaf2] transition-colors p-1" onClick={(e) => e.stopPropagation()}>
              <Search className="size-[18px]" />
            </button>
            <button className="text-[#8b949e] hover:text-[#e6eaf2] transition-colors p-1" aria-label="Toggle Layers">
              {layersOpen ? <ChevronUp className="size-[18px]" /> : <ChevronDown className="size-[18px]" />}
            </button>
          </div>
        </div>

        {/* Expandable Content */}
        <div className={cn("transition-opacity duration-300", layersOpen ? "opacity-100" : "opacity-0 pointer-events-none hidden")}>
          <div className="mt-5 mb-3 text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold">Layers</div>
          
          <div className="space-y-3.5 mb-5">
            {layers.map((l) => (
              <label key={l.id} className="flex items-center gap-3 cursor-pointer group select-none">
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={l.on} 
                  onChange={() => toggleLayer(l.id)} 
                />
                <span
                  className={cn(
                    "size-4 rounded-full border-[1.5px] flex items-center justify-center transition-all",
                    l.on ? "border-transparent" : "border-[#30363d]"
                  )}
                  style={{ background: l.on ? l.color : "transparent" }}
                >
                  {l.on && <span className="size-1.5 bg-[#0f141f] rounded-full shadow-sm" />}
                </span>
                <span className={cn(
                  "text-[13px] font-medium transition-colors", 
                  l.on ? "text-[#e6eaf2]" : "text-[#8b949e]"
                )}>
                  {l.label}
                </span>
                <span className="ml-auto text-[11px] text-[#8b949e] tabular-nums font-medium">
                  {l.id === "hotspots" ? "612" : l.id === "hexbin" ? "94" : l.id === "blind" ? "37" : "1.1k"}
                </span>
              </label>
            ))}
          </div>

          <div className="pt-3 border-t border-[#1e2532]">
            <button 
              onClick={(e) => { e.stopPropagation(); setLayers(initialLayers); }} 
              className="text-[12px] text-[#8b949e] hover:text-[#e6eaf2] font-medium transition-colors"
            >
              Reset layers
            </button>
          </div>
        </div>
      </div>

      {/* 3. Detail Drawer for Selected Hotspot */}
      {selected && (
        <div className={cn(
          "absolute top-5 right-5 w-[340px] rounded-xl border border-[#1e2532] bg-[#0f141f]/95 backdrop-blur-md shadow-2xl flex flex-col transition-all duration-300 z-[1000]",
          drawerOpen ? "bottom-5" : "max-h-[72px]"
        )}>
          <div 
            className={cn("px-5 py-4 flex items-start justify-between cursor-pointer", drawerOpen && "border-b border-[#1e2532]")}
            onClick={() => setDrawerOpen(!drawerOpen)}
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-1">Cluster</div>
              <div className="font-medium text-[18px] text-[#e6eaf2] tracking-tight flex gap-2 items-center">
                {selected.id}
                {!drawerOpen && <span className="text-[13px] text-[#8b949e] font-normal tracking-normal truncate max-w-[150px]">{selected.name}</span>}
              </div>
              {drawerOpen && <div className="text-[13px] text-[#8b949e] mt-0.5">{selected.name}</div>}
            </div>
            <div className="flex gap-1">
              <button className="text-[#8b949e] hover:text-[#e6eaf2] p-1 rounded-md transition-colors bg-transparent">
                {drawerOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setSelected(null); }} 
                className="text-[#8b949e] hover:text-[#ef4444] p-1 rounded-md transition-colors bg-transparent ml-1"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {drawerOpen && (
            <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300">
              <div className="px-5 py-5 border-b border-[#1e2532] grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-1">Violations</div>
                  <div className="text-[28px] font-light text-[#e6eaf2] tabular-nums tracking-tight">
                    {selected.violations.toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-1">Severity</div>
                  <div className="text-[28px] font-light tabular-nums tracking-tight" style={{ color: selected.intensity > 0.7 ? "#ef4444" : "#f5a623" }}>
                    {Math.round(selected.intensity * 100)}
                  </div>
                </div>
              </div>

              <div className="px-5 py-5 border-b border-[#1e2532]">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b949e] font-semibold mb-3">Dominant Profile</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#8b949e]">Violation</span>
                    <span className="text-[#e6eaf2] font-medium">{selected.dominant_violation}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#8b949e]">Peak Shift</span>
                    <span className="text-[#e6eaf2] font-medium">{selected.shift}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#8b949e]">Road</span>
                    <span className="text-[#e6eaf2] font-medium">{selected.road_class}</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto px-5 py-4 border-t border-[#1e2532] bg-[#161b22]/50">
                <button className="w-full rounded-md bg-[#38b2ac] hover:bg-[#319795] text-[#0d1117] font-semibold text-[13px] py-2.5 transition-colors shadow-sm">
                  Dispatch patrol to {selected.name}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}