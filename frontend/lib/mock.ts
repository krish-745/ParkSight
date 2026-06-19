import type {
  Breakdown,
  CoverageCurve,
  Hotspot,
  OptimizeResult,
  PatrolPlanItem,
  Stats,
  Temporal,
} from './types'

// ---------- deterministic RNG ----------
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STATIONS = [
  'Upparpet',
  'Shivajinagar',
  'HAL Old Airport',
  'Malleshwaram',
  'Vijayanagara',
  'Cubbon Park',
  'Magadi Road',
  'Banaswadi',
  'Jeevanbheemanagar',
  'Halasuru Gate',
  'Commercial Street',
  'Wilson Garden',
  'Basavanagudi',
  'Rajajinagar',
  'Yeshwantpur',
]

const VIOLATIONS = [
  'WRONG PARKING',
  'NO PARKING',
  'PARKING IN A MAIN ROAD',
  'DEFECTIVE NUMBER PLATE',
  'PARKING ON FOOTPATH',
  'PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC',
  'PARKING NEAR ROAD CROSSING',
  'DOUBLE PARKING',
]

const VEHICLES = [
  'CAR',
  'SCOOTER',
  'MOTOR CYCLE',
  'PASSENGER AUTO',
  'MAXI-CAB',
  'LGV',
  'GOODS AUTO',
  'MOPED',
]

const ROAD_CLASSES = [
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'unclassified',
]

const SHIFTS = [
  'Morning (06:00-12:00)',
  'Afternoon (12:00-17:00)',
  'Evening (17:00-22:00)',
  'Night (22:00-06:00)',
]

const JUNCTIONS = [
  'Elite Junction',
  'Safina Plaza Junction',
  'Trinity Circle',
  'Richmond Circle',
  'Hudson Circle',
  'Maharani Junction',
  'Cauvery Junction',
  'Minerva Circle',
]

// Cluster centers across Bengaluru core
const CLUSTERS: [number, number][] = [
  [12.9732, 77.5775],
  [12.9819, 77.6078],
  [12.9337, 77.6909],
  [13.0028, 77.5533],
  [12.978, 77.5531],
  [12.9663, 77.6415],
  [12.9981, 77.6717],
  [12.9412, 77.5709],
  [12.9916, 77.5712],
  [12.9279, 77.6271],
  [13.0089, 77.5895],
  [12.9542, 77.6068],
]

function buildHotspots(): Hotspot[] {
  const rng = mulberry32(42)
  const N = 612
  const raw: Omit<Hotspot, 'rank' | 'cii_normalized' | 'impact'>[] = []

  for (let i = 0; i < N; i++) {
    const c = CLUSTERS[Math.floor(rng() * CLUSTERS.length)]
    const spread = 0.012 + rng() * 0.02
    const lat = c[0] + (rng() - 0.5) * spread
    const lon = c[1] + (rng() - 0.5) * spread

    // power-law violations: a couple very large, long tail
    let violations: number
    if (i === 0) violations = 22864
    else if (i === 1) violations = 9821
    else {
      const base = Math.pow(rng(), 3.2)
      violations = Math.round(120 + base * 6000)
    }

    const cii = violations * (0.9 + rng() * 1.4)
    const junction_pct = rng() > 0.45 ? Math.round(rng() * 1000) / 10 : 0
    const peak_hour = [8, 9, 10, 11, 4, 6, 7][Math.floor(rng() * 7)]
    const shift =
      peak_hour >= 6 && peak_hour < 12
        ? SHIFTS[0]
        : peak_hour >= 12 && peak_hour < 17
          ? SHIFTS[1]
          : peak_hour >= 17 && peak_hour < 22
            ? SHIFTS[2]
            : SHIFTS[3]

    raw.push({
      id: i,
      lat,
      lon,
      cii,
      violations,
      junction_pct,
      peak_hour,
      shift,
      radius_m: Math.round((120 + Math.sqrt(violations) * 4) * 10) / 10,
      station: STATIONS[Math.floor(rng() * STATIONS.length)],
      dominant_junction:
        junction_pct > 0
          ? `BTP${String(Math.floor(rng() * 99)).padStart(3, '0')} - ${
              JUNCTIONS[Math.floor(rng() * JUNCTIONS.length)]
            }`
          : 'No Junction',
      dominant_violation:
        VIOLATIONS[Math.floor(Math.pow(rng(), 1.6) * VIOLATIONS.length)],
      dominant_vehicle:
        VEHICLES[Math.floor(Math.pow(rng(), 1.4) * VEHICLES.length)],
      road_class: ROAD_CLASSES[Math.floor(rng() * ROAD_CLASSES.length)],
      lanes: 1 + Math.floor(rng() * 4),
    })
  }

  // sort by cii desc -> rank + normalize
  raw.sort((a, b) => b.cii - a.cii)
  const maxCii = raw[0].cii
  return raw.map((h, idx) => ({
    ...h,
    rank: idx + 1,
    cii: Math.round(h.cii * 10) / 10,
    cii_normalized: Math.round((h.cii / maxCii) * 10000) / 100,
    impact: Math.round(h.cii * (0.55 + 0.25) * 10) / 10,
  }))
}

export const HOTSPOTS: Hotspot[] = buildHotspots()
const TOTAL_IMPACT = HOTSPOTS.reduce((s, h) => s + h.impact, 0)

export const STATS: Stats = {
  total_hotspots: 612,
  total_violations: 115350,
  clustered_pct: 93.1,
  noise_pct: 6.9,
  date_range: 'Nov 2023 - Apr 2024',
  peak_window_ist: 'Morning (06:00-12:00)',
  evening_share_pct: 0.2,
  top_stations: [
    'Upparpet',
    'Shivajinagar',
    'HAL Old Airport',
    'Malleshwaram',
    'Vijayanagara',
  ],
  recommended_fleet: 22,
  coverage_at_recommended_pct: 77.0,
}

export const BREAKDOWN: Breakdown = {
  violation_types: [
    { name: 'WRONG PARKING', count: 60150 },
    { name: 'NO PARKING', count: 57186 },
    { name: 'PARKING IN A MAIN ROAD', count: 8571 },
    { name: 'DEFECTIVE NUMBER PLATE', count: 3061 },
    { name: 'PARKING ON FOOTPATH', count: 1303 },
    { name: 'PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC', count: 867 },
    { name: 'PARKING NEAR ROAD CROSSING', count: 624 },
    { name: 'DOUBLE PARKING', count: 624 },
  ],
  vehicle_types: [
    { name: 'CAR', count: 36803 },
    { name: 'SCOOTER', count: 35708 },
    { name: 'MOTOR CYCLE', count: 15090 },
    { name: 'PASSENGER AUTO', count: 13859 },
    { name: 'MAXI-CAB', count: 4876 },
    { name: 'LGV', count: 3151 },
    { name: 'GOODS AUTO', count: 1148 },
    { name: 'MOPED', count: 762 },
  ],
}

export const TEMPORAL: Temporal = {
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  hours: Array.from({ length: 24 }, (_, i) => i),
  matrix: [
    [
      262, 351, 543, 653, 862, 829, 767, 971, 1201, 1119, 1299, 1545, 809, 513,
      249, 50, 11, 9, 5, 1, 0, 0, 0, 18,
    ],
    [
      217, 568, 821, 1188, 1452, 1522, 1121, 1174, 1820, 1301, 1603, 1430, 868,
      465, 210, 48, 31, 15, 8, 0, 0, 0, 47, 20,
    ],
    [
      201, 616, 1092, 1078, 1617, 1502, 1221, 1358, 1456, 1425, 1670, 1503, 974,
      624, 163, 37, 32, 9, 1, 0, 10, 7, 26, 38,
    ],
    [
      290, 788, 1234, 1740, 1782, 1670, 1721, 1467, 1675, 1588, 1839, 1764, 847,
      397, 233, 45, 26, 12, 3, 0, 0, 11, 4, 11,
    ],
    [
      219, 671, 878, 1333, 1529, 1600, 1334, 1110, 1415, 1565, 1604, 1529, 755,
      548, 273, 52, 11, 8, 0, 2, 1, 3, 31, 11,
    ],
    [
      208, 568, 1200, 1426, 1421, 1310, 1278, 955, 1404, 1521, 1743, 1679, 1064,
      643, 297, 95, 51, 18, 6, 0, 0, 0, 41, 10,
    ],
    [
      324, 524, 769, 973, 1175, 1310, 1098, 1247, 1971, 1823, 2303, 2032, 1050,
      740, 508, 99, 51, 30, 14, 1, 1, 15, 28, 41,
    ],
  ],
  peak_hours: [10, 11, 8, 9],
  evening_share_pct: 0.2,
}

// ---------- geometry + optimizer ----------
function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function dominantShift(ids: number[]): string {
  const tally: Record<string, number> = {}
  for (const id of ids) {
    const s = HOTSPOTS[id].shift
    tally[s] = (tally[s] ?? 0) + HOTSPOTS[id].impact
  }
  return (
    Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? SHIFTS[0]
  )
}

// Greedy maximum-coverage over impact
function greedyCover(k: number, radius: number): PatrolPlanItem[] {
  const covered = new Set<number>()
  const plan: PatrolPlanItem[] = []
  // candidate centers = every hotspot location
  for (let p = 0; p < k; p++) {
    let best = -1
    let bestGain = -1
    let bestIds: number[] = []
    for (let c = 0; c < HOTSPOTS.length; c++) {
      let gain = 0
      const ids: number[] = []
      const cc = HOTSPOTS[c]
      for (const h of HOTSPOTS) {
        if (covered.has(h.id)) continue
        if (haversine(cc.lat, cc.lon, h.lat, h.lon) <= radius) {
          gain += h.impact
          ids.push(h.id)
        }
      }
      if (gain > bestGain) {
        bestGain = gain
        best = c
        bestIds = ids
      }
    }
    if (best < 0 || bestIds.length === 0) break
    bestIds.forEach((id) => covered.add(id))
    const center = HOTSPOTS[best]
    plan.push({
      rank: p + 1,
      lat: center.lat,
      lon: center.lon,
      station: center.station,
      road_class: center.road_class,
      lanes: center.lanes,
      hotspots_covered: bestIds.length,
      covered_ids: bestIds,
      recommended_shift: dominantShift(bestIds),
      impact_covered_pct: Math.round((bestGain / TOTAL_IMPACT) * 10000) / 100,
    })
  }
  return plan
}

function coverageOf(centers: { lat: number; lon: number }[], radius: number) {
  const covered = new Set<number>()
  for (const ctr of centers) {
    for (const h of HOTSPOTS) {
      if (covered.has(h.id)) continue
      if (haversine(ctr.lat, ctr.lon, h.lat, h.lon) <= radius)
        covered.add(h.id)
    }
  }
  let imp = 0
  covered.forEach((id) => (imp += HOTSPOTS[id].impact))
  return (imp / TOTAL_IMPACT) * 100
}

// "volume-only" baseline: top-k hotspots by violations as centers
function volumeCenters(k: number) {
  return [...HOTSPOTS]
    .sort((a, b) => b.violations - a.violations)
    .slice(0, k)
    .map((h) => ({ lat: h.lat, lon: h.lon }))
}

// "even spread" baseline: spatially spread centers (farthest-point)
function evenCenters(k: number) {
  const pts = HOTSPOTS
  const chosen: { lat: number; lon: number }[] = [
    { lat: pts[0].lat, lon: pts[0].lon },
  ]
  while (chosen.length < k) {
    let best = -1
    let bestDist = -1
    for (const h of pts) {
      let d = Infinity
      for (const c of chosen)
        d = Math.min(d, haversine(c.lat, c.lon, h.lat, h.lon))
      if (d > bestDist) {
        bestDist = d
        best = h.id
      }
    }
    if (best < 0) break
    chosen.push({ lat: pts[best].lat, lon: pts[best].lon })
  }
  return chosen
}

export function optimize(
  num_patrols: number,
  cover_radius_m: number,
): OptimizeResult {
  const plan = greedyCover(num_patrols, cover_radius_m)
  const total = plan.reduce((s, p) => s + p.impact_covered_pct, 0)
  const evenPct = coverageOf(evenCenters(num_patrols), cover_radius_m)
  const volPct = coverageOf(volumeCenters(num_patrols), cover_radius_m)
  return {
    num_patrols,
    cover_radius_m,
    total_coverage_pct: Math.round(total * 10) / 10,
    baseline_even_pct: Math.round(evenPct * 10) / 10,
    baseline_volume_pct: Math.round(volPct * 10) / 10,
    plan,
  }
}

export function coverageCurve(
  kmax = 25,
  cover_radius_m = 1000,
): CoverageCurve {
  const k: number[] = []
  const optimized_pct: number[] = []
  const even_pct: number[] = []
  const volume_pct: number[] = []

  // full greedy once up to kmax, accumulate
  const fullPlan = greedyCover(kmax, cover_radius_m)
  let acc = 0
  for (let i = 1; i <= kmax; i++) {
    k.push(i)
    acc += fullPlan[i - 1]?.impact_covered_pct ?? 0
    optimized_pct.push(Math.round(acc * 10) / 10)
    even_pct.push(
      Math.round(coverageOf(evenCenters(i), cover_radius_m) * 10) / 10,
    )
    volume_pct.push(
      Math.round(coverageOf(volumeCenters(i), cover_radius_m) * 10) / 10,
    )
  }

  // elbow = recommended fleet
  const elbow = STATS.recommended_fleet
  return {
    k,
    optimized_pct,
    even_pct,
    volume_pct,
    elbow,
    elbow_coverage_pct: optimized_pct[elbow - 1] ?? optimized_pct.at(-1) ?? 0,
  }
}
