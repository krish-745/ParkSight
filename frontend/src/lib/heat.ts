// Shared heat ramp: teal → orange → red, matching the design tokens.
// Lives in lib (no Leaflet import) so it's safe to use in SSR-rendered UI
// (e.g. the Time Machine bar strip) as well as inside the client-only map.
export function heatColor(t: number): string {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    const u = t / 0.5;
    return `rgb(${Math.round(56 + (245 - 56) * u)},${Math.round(178 + (166 - 178) * u)},${Math.round(172 + (35 - 172) * u)})`;
  }
  const u = (t - 0.5) / 0.5;
  return `rgb(${Math.round(245 + (239 - 245) * u)},${Math.round(166 + (68 - 166) * u)},${Math.round(35 + (68 - 35) * u)})`;
}
