import { hotspots, heatBlobs } from "@/data/mock";

type Props = {
  className?: string;
  showLabels?: boolean;
  showBlobs?: boolean;
  showDots?: boolean;
};

// Stylized city-grid SVG with radial heat blobs and dot clusters.
export function HeatMap({ className, showLabels = false, showBlobs = true, showDots = true }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-label="City hotspot heatmap"
    >
      <defs>
        <radialGradient id="heat" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-critical)" stopOpacity="0.75" />
          <stop offset="45%" stopColor="var(--color-warning)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-warning)" stopOpacity="0" />
        </radialGradient>
        <pattern id="streets" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0 H6 M0 0 V6" stroke="var(--color-divider)" strokeOpacity="0.18" strokeWidth="0.15" />
        </pattern>
        <pattern id="majors" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
          <path d="M0 9 H18 M9 0 V18" stroke="var(--color-divider)" strokeOpacity="0.4" strokeWidth="0.25" />
        </pattern>
      </defs>

      {/* base */}
      <rect width="100" height="100" fill="var(--color-navy)" />
      <rect width="100" height="100" fill="url(#streets)" />
      <rect width="100" height="100" fill="url(#majors)" />

      {/* arterial curves */}
      <path d="M-5 70 Q 30 40 60 55 T 110 30" stroke="var(--color-divider)" strokeOpacity="0.55" strokeWidth="0.5" fill="none" />
      <path d="M-5 30 Q 40 60 70 45 T 110 70" stroke="var(--color-divider)" strokeOpacity="0.45" strokeWidth="0.4" fill="none" />

      {showBlobs &&
        heatBlobs.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="url(#heat)" opacity={b.intensity} />
        ))}

      {showDots &&
        hotspots.map((h) => (
          <circle
            key={h.id}
            cx={h.x}
            cy={h.y}
            r={0.35 + h.intensity * 0.9}
            fill={h.intensity > 0.7 ? "var(--color-critical)" : h.intensity > 0.4 ? "var(--color-warning)" : "var(--color-info)"}
            opacity={0.55 + h.intensity * 0.4}
          />
        ))}

      {showLabels && (
        <>
          <text x="50" y="48" fontSize="1.6" fill="var(--color-text-secondary)" textAnchor="middle" fontFamily="var(--font-display)">
            MG ROAD
          </text>
          <text x="38" y="60" fontSize="1.4" fill="var(--color-text-secondary)" textAnchor="middle" fontFamily="var(--font-display)">
            KORAMANGALA
          </text>
          <text x="60" y="38" fontSize="1.4" fill="var(--color-text-secondary)" textAnchor="middle" fontFamily="var(--font-display)">
            INDIRANAGAR
          </text>
        </>
      )}
    </svg>
  );
}