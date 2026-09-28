import type { Booking, Profile } from '@/types/database';

// Companion bookings carry their own guest_name; self-bookings fall back to
// the booker's profile (short_name preferred for the casual, first-name-ish feel).
export function bookingDisplayName(booking: Pick<Booking, 'is_guest' | 'guest_name'>, profile?: Pick<Profile, 'short_name' | 'full_name'> | null): string {
  if (booking.is_guest && booking.guest_name) return booking.guest_name;
  return profile?.short_name || profile?.full_name || 'Player';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(time: string): string {
  // time comes as "20:00:00" from the DB
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${period}`;
}

export function getDayName(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-MY', { weekday: 'long' });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function toInputDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function toInputTime(time: string): string {
  return time.slice(0, 5);
}

// ===== VSB V2: locale-aware date parts for editorial date blocks =====
// `lang` is the i18next language ('en' | 'ms'). Session dates are plain
// YYYY-MM-DD strings; parse them as local dates so the day never shifts.
function localeFor(lang: string) {
  return lang.startsWith('ms') ? 'ms-MY' : 'en-MY';
}

function toLocalDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : new Date(date);
}

export function dateParts(date: string | Date, lang: string) {
  const d = toLocalDate(date);
  const loc = localeFor(lang);
  return {
    weekday: d.toLocaleDateString(loc, { weekday: 'short' }).replace('.', '').toUpperCase(),
    day: d.getDate(),
    month: d.toLocaleDateString(loc, { month: 'short' }).replace('.', '').toUpperCase(),
  };
}

export function formatDateLocale(date: string | Date, lang: string, style: 'long' | 'medium' = 'long'): string {
  const d = toLocalDate(date);
  return d.toLocaleDateString(localeFor(lang), style === 'long'
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { weekday: 'short', day: 'numeric', month: 'short' });
}
