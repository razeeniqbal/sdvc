// Subtle top-down volleyball court geometry drawn in SVG (18m × 9m court,
// 3m attack lines, centre line). Decorative background only — aria-hidden.
// Scales to whatever box it's placed in; `preserveAspectRatio` slice keeps the
// lines crisp at any width instead of stretching.
export function CourtLines({ className = '', opacity = 0.07 }: { className?: string; opacity?: number }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full [&_*]:[vector-effect:non-scaling-stroke] ${className}`}
      viewBox="0 0 200 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
    >
      <g fill="none" stroke="#F4F1EA" strokeOpacity={opacity} strokeWidth="1">
        <rect x="46" y="27.5" width="108" height="54" />
        <line x1="100" y1="22" x2="100" y2="87" strokeOpacity={opacity * 1.6} />
        <line x1="82" y1="27.5" x2="82" y2="81.5" />
        <line x1="118" y1="27.5" x2="118" y2="81.5" />
        <line x1="82" y1="24" x2="82" y2="26" />
        <line x1="118" y1="24" x2="118" y2="26" />
      </g>
    </svg>
  );
}
