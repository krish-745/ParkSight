export const region = {
  name: "Bengaluru · Urban Core",
  range: "Nov 2023 – Apr 2024",
};

export const kpis = {
  hotspots: 612,
  violations: 115350,
  fleet: 22,
  coverage: 77,
};

export const topHotspots = [
  { rank: 1, name: "MG Road · Trinity Circle", violations: 4820, trend: 12 },
  { rank: 2, name: "Koramangala 5th Block", violations: 4112, trend: 8 },
  { rank: 3, name: "Indiranagar 100ft Rd", violations: 3877, trend: -3 },
  { rank: 4, name: "HSR Sector 1 Market", violations: 3204, trend: 5 },
  { rank: 5, name: "Brigade Rd · Church St", violations: 2998, trend: 17 },
];

// Hotspot points in a 0–100 coordinate system for the SVG map.
export type Hotspot = { id: string; x: number; y: number; intensity: number; violations: number; name: string };

function seeded(n: number) {
  // deterministic pseudo-random
  return ((Math.sin(n) * 10000) % 1 + 1) % 1;
}

export const hotspots: Hotspot[] = Array.from({ length: 220 }, (_, i) => {
  const cx = 50 + Math.cos(i * 0.6) * (12 + seeded(i) * 18);
  const cy = 50 + Math.sin(i * 0.7) * (10 + seeded(i + 1) * 16);
  return {
    id: `H-${i.toString().padStart(3, "0")}`,
    x: Math.max(2, Math.min(98, cx + (seeded(i + 7) - 0.5) * 14)),
    y: Math.max(2, Math.min(98, cy + (seeded(i + 11) - 0.5) * 12)),
    intensity: seeded(i + 3),
    violations: Math.round(40 + seeded(i + 5) * 900),
    name: `Cluster ${i + 1}`,
  };
});

export const heatBlobs = [
  { x: 48, y: 46, r: 18, intensity: 1 },
  { x: 38, y: 58, r: 14, intensity: 0.8 },
  { x: 60, y: 40, r: 12, intensity: 0.7 },
  { x: 56, y: 62, r: 10, intensity: 0.6 },
  { x: 42, y: 38, r: 9, intensity: 0.5 },
];

export const peakHours = [4, 6, 8, 14, 22, 38, 64, 82, 71, 55, 48, 52, 60, 73, 88, 96, 90, 78, 62, 44, 30, 22, 14, 8];

export const layers = [
  { id: "hotspots", label: "Hotspot clusters", color: "var(--color-warning)", on: true },
  { id: "hexbin", label: "Hexbin congestion", color: "var(--color-critical)", on: true },
  { id: "blind", label: "Blind spots", color: "var(--color-info)", on: false },
  { id: "violations", label: "Raw violations", color: "var(--color-active)", on: true },
];