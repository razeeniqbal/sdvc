import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Shared presentation for VSB Admin pages. Operational, compact, text-first.

export function AdminPageHeader({ meta, title, subtitle, actions, back }: {
  meta?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className="mb-6 lg:mb-8">
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted hover:text-chalk">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {meta && <p className="adm-label mb-2">{meta}</p>}
          <h1 className="adm-title">{title}</h1>
          {subtitle && <div className="mt-2 text-sm text-slate-400">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// Large operational number. `tone` colours only the small indicator; the label
// always states what the number means.
export function Stat({ label, value, hint, tone = 'neutral' }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'good' | 'attention' | 'critical';
}) {
  const dot = { neutral: 'bg-ink-500', good: 'bg-green-500', attention: 'bg-amber-400', critical: 'bg-red-500' }[tone];
  return (
    <div className="min-w-0">
      <p className="adm-label flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />{label}</p>
      <p className="adm-num mt-2 text-4xl lg:text-5xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-ink-600 pb-2">
      <h2 id={id} className="font-display text-lg font-bold uppercase tracking-[0.12em] text-chalk">{children}</h2>
      {action}
    </div>
  );
}

// Operational state label: coloured dot + text (never colour alone).
export type OpsTone = 'good' | 'attention' | 'critical' | 'neutral' | 'info';
export function OpsBadge({ tone, children }: { tone: OpsTone; children: ReactNode }) {
  const map: Record<OpsTone, string> = {
    good: 'text-green-300 border-green-500/40 bg-green-500/10',
    attention: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    critical: 'text-red-300 border-red-500/40 bg-red-500/10',
    neutral: 'text-slate-300 border-ink-500 bg-ink-700',
    info: 'text-vsb-200 border-vsb-700 bg-vsb-900/50',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${map[tone]}`}>
      {children}
    </span>
  );
}
