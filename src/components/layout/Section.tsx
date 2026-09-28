import type { ReactNode } from 'react';

// Full-width page section: edge-to-edge background, safe-area gutter inside.
// Use `divider` for the thin court-line rule between editorial sections.
export function FullWidthSection({
  children,
  className = '',
  divider = false,
  id,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  divider?: boolean;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`vsb-section relative ${divider ? 'border-t border-ink-600' : ''} ${className}`}>
      {children}
    </section>
  );
}

// Metadata line + large title, the standard editorial section opener.
export function SectionHeader({
  meta,
  title,
  id,
  aside,
  className = '',
}: {
  meta?: ReactNode;
  title: ReactNode;
  id?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-3 ${className}`}>
      <div>
        {meta && <p className="vsb-meta mb-3">{meta}</p>}
        <h2 id={id} className="vsb-display text-4xl sm:text-5xl lg:text-6xl">{title}</h2>
      </div>
      {aside}
    </div>
  );
}
