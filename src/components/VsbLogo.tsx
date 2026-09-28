import { srcSet, vsbAssets } from '@/lib/vsbAssets';

// Canonical VSB logo from the production artwork. Never redraw it in CSS/text,
// stretch it, or box it.
//   lockup — letters + VOLLEYBALL SDN BHD: landing, auth, footer, admin sidebar
//   mark   — letters only: compact / mobile navigation
const VARIANTS = {
  lockup: [vsbAssets.brand.lockup, vsbAssets.brand.lockupSm],
  mark: [vsbAssets.brand.mark, vsbAssets.brand.markSm],
} as const;

export function VsbLogo({ variant = 'mark', className = '', sizes = '200px' }: {
  variant?: keyof typeof VARIANTS;
  className?: string;
  sizes?: string;
}) {
  const [large, small] = VARIANTS[variant];
  return (
    <img
      src={small.src}
      srcSet={srcSet(small, large)}
      sizes={sizes}
      width={large.width}
      height={large.height}
      alt="VSB — Volleyball Sdn Bhd"
      className={`w-auto ${className}`}
    />
  );
}
