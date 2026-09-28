import { useTranslation } from 'react-i18next';

// Loading placeholders shaped like the content they stand in for, so a page
// keeps its composition while data arrives. Decorative to assistive tech; the
// wrapper announces "Loading" once.

function Loading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

const Bar = ({ className }: { className: string }) => <div className={`vsb-skel ${className}`} />;

// A session fixture row (Sessions, Home).
export function FixtureSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Loading className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid border border-ink-600 md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1.3fr)_minmax(0,1fr)_12rem]">
          <div className="min-h-[9rem] bg-ink-800 p-5"><Bar className="h-4 w-10" /><Bar className="mt-2 h-12 w-14" /><Bar className="mt-2 h-4 w-10" /></div>
          <div className="space-y-3 p-5"><Bar className="h-5 w-24" /><Bar className="h-8 w-2/3" /><Bar className="h-4 w-1/3" /></div>
          <div className="hidden space-y-3 p-5 xl:block"><Bar className="h-3 w-24" /><Bar className="h-9 w-40" /><Bar className="h-2 w-full" /></div>
          <div className="hidden p-5 xl:block"><Bar className="h-10 w-20" /></div>
        </div>
      ))}
    </Loading>
  );
}

// A dated list (My Games timeline, recent games).
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Loading className="divide-y divide-ink-700 border-y border-ink-600">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          <div className="w-14 space-y-1.5"><Bar className="mx-auto h-7 w-8" /><Bar className="mx-auto h-3 w-8" /></div>
          <div className="flex-1 space-y-2"><Bar className="h-5 w-1/2" /><Bar className="h-3 w-1/3" /></div>
        </div>
      ))}
    </Loading>
  );
}

// Community roster tiles.
export function RosterSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <Loading className="grid grid-cols-1 border-l border-t border-ink-600 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} className="flex gap-4 border-b border-r border-ink-600 p-5">
          <Bar className="h-20 w-20 !rounded-full" />
          <div className="flex-1 space-y-2 pt-1"><Bar className="h-6 w-2/3" /><Bar className="h-3 w-1/2" /><Bar className="h-3 w-1/3" /></div>
        </div>
      ))}
    </Loading>
  );
}

// A booking / ticket page: header band + two columns.
export function TicketSkeleton() {
  return (
    <Loading>
      <div className="vsb-gutter border-b border-ink-600 py-10 lg:py-14">
        <Bar className="h-4 w-40" />
        <Bar className="mt-4 h-14 w-2/3 max-w-xl" />
        <Bar className="mt-4 h-5 w-1/2 max-w-md" />
      </div>
      <div className="vsb-gutter grid gap-10 py-10 lg:grid-cols-2">
        <div className="space-y-3"><Bar className="h-5 w-32" /><Bar className="h-24 w-full" /></div>
        <div className="space-y-3"><Bar className="h-5 w-32" /><Bar className="h-40 w-full" /></div>
      </div>
    </Loading>
  );
}

// Session details opening: visual | details.
export function SessionSkeleton() {
  return (
    <Loading>
      <div className="grid border-b border-ink-600 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="min-h-[16rem] bg-ink-800 lg:min-h-[32rem]" />
        <div className="vsb-gutter space-y-4 py-10 lg:!px-10">
          <Bar className="h-4 w-32" /><Bar className="h-14 w-3/4" /><Bar className="h-5 w-1/2" />
          <Bar className="mt-8 h-12 w-40" /><Bar className="h-12 w-full" />
        </div>
      </div>
    </Loading>
  );
}

// My VSB identity: card | hub.
export function IdentitySkeleton() {
  return (
    <Loading className="vsb-gutter grid items-center gap-10 py-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:py-16">
      <Bar className="mx-auto aspect-[5/7] w-full max-w-[24rem] lg:mx-0" />
      <div className="space-y-4"><Bar className="h-4 w-24" /><Bar className="h-16 w-2/3" /><Bar className="h-4 w-1/3" /><Bar className="mt-8 h-16 w-full max-w-xl" /></div>
    </Loading>
  );
}
