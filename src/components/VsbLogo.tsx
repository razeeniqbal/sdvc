// Canonical VSB logo, sliced from the approved logo artwork (public/brand/).
// Never redraw it in CSS/SVG — swap these files when vector exports exist.
// `lockup` includes the VOLLEYBALL SDN BHD line; `mark` is just the letters.
const SOURCES = {
  lockup: { src: '/brand/vsb-logo.png', width: 520, height: 157 },
  mark: { src: '/brand/vsb-mark.png', width: 520, height: 116 },
} as const;

export function VsbLogo({ variant = 'mark', className = '' }: { variant?: keyof typeof SOURCES; className?: string }) {
  const { src, width, height } = SOURCES[variant];
  return <img src={src} width={width} height={height} alt="VSB — Volleyball Sdn Bhd" className={`w-auto ${className}`} />;
}
