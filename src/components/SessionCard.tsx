import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { getSessionStatus, type SessionWithCount } from '@/lib/sessions';
import { formatCurrency, formatDate, formatTime, getDayName } from '@/lib/format';

const statusStyles: Record<string, string> = {
  Available: 'bg-green-100 text-green-800 border-green-200',
  'Almost Full': 'bg-amber-100 text-amber-800 border-amber-200',
  'Fully Booked': 'bg-red-100 text-red-700 border-red-200',
  'Booking Closed': 'bg-slate-100 text-slate-600 border-slate-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const sessionStatusKeyMap: Record<string, string> = {
  Available: 'sessionStatus.available',
  'Almost Full': 'sessionStatus.almostFull',
  'Fully Booked': 'sessionStatus.fullyBooked',
  'Booking Closed': 'sessionStatus.bookingClosed',
  Cancelled: 'sessionStatus.cancelled',
};

export function SessionCard({ session, to }: { session: SessionWithCount; to: string }) {
  const { t } = useTranslation();
  const status = getSessionStatus(session, session.confirmed_count);
  const available = session.maximum_capacity - session.confirmed_count;
  const canBook = status === 'Available' || status === 'Almost Full';
  const isAlmostFull = status === 'Almost Full';

  return (
    <Link
      to={to}
      className={`bg-white rounded-2xl border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden group ${
        isAlmostFull ? 'border-amber-300' : 'border-slate-200'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 group-hover:text-navy-700 transition-colors">{session.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{getDayName(session.session_date)}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
            {t(sessionStatusKeyMap[status] || status)}
          </span>
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span>{formatDate(session.session_date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span>{formatTime(session.start_time)} - {formatTime(session.end_time)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{session.venue_name} {session.court_number && `· ${session.court_number}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className={available <= 3 && canBook ? 'text-amber-600 font-semibold' : ''}>
              {t('sessions.slotsLeft', { count: available, max: session.maximum_capacity })}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-lg font-semibold text-slate-900">{session.price > 0 ? formatCurrency(session.price) : 'TBC'}</span>
          <span className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
            canBook
              ? 'bg-navy-700 text-white group-hover:bg-navy-800'
              : 'bg-slate-100 text-slate-400'
          }`}>
            {canBook ? t('sessions.bookNow') : status === 'Fully Booked' ? t('sessions.waitlist') : t('sessions.view')}
          </span>
        </div>
      </div>
    </Link>
  );
}
