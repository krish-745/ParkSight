// Shared formatting utilities

/**
 * Format a number in Indian locale (e.g. 1,23,456)
 */
export function formatIN(n: number): string {
  return n.toLocaleString('en-IN')
}

/**
 * Map a normalized CII score (0–100) to a heat color string.
 * Yellow → Orange → Red
 */
export function heatColor(norm: number): string {
  const t = Math.max(0, Math.min(1, norm / 100))
  const lerp = (a: number, b: number, x: number) => Math.round(a + (b - a) * x)
  if (t < 0.5) {
    const x = t / 0.5
    return `rgb(${lerp(252, 249, x)},${lerp(211, 115, x)},${lerp(77, 22, x)})`
  }
  const x = (t - 0.5) / 0.5
  return `rgb(${lerp(249, 220, x)},${lerp(115, 38, x)},${lerp(22, 38, x)})`
}

/**
 * Format a number compactly (e.g. 1.2K, 1M)
 */
export function formatCompact(n: number): string {
  return Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}
