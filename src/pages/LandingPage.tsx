import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, MapPin, Users, ArrowRight, MessageCircle, Phone, Info, Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { fetchSessionsWithCounts, getSessionStatus, type SessionWithCount } from '@/lib/sessions';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import type { ClubSettings } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

const heroImage = 'https://images.pexels.com/photos/6203569/pexels-photo-6203569.jpeg?auto=compress&cs=tinysrgb&w=1600';
const aboutImage = 'https://images.pexels.com/photos/6203525/pexels-photo-6203525.jpeg?auto=compress&cs=tinysrgb&w=1200';

const sessionStatusKeyMap: Record<string, string> = {
  Available: 'sessionStatus.available',
  'Almost Full': 'sessionStatus.almostFull',
  'Fully Booked': 'sessionStatus.fullyBooked',
  'Booking Closed': 'sessionStatus.bookingClosed',
  Cancelled: 'sessionStatus.cancelled',
};

// Fades a section in the first time it scrolls into view. Disconnects after firing
// once so it doesn't re-trigger on scroll-up, and does nothing (renders normally)
// under prefers-reduced-motion via the CSS in index.css.
function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={visible ? 'animate-reveal' : 'reveal-hidden'}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSessionsWithCounts(), fetchClubSettings()])
      .then(([s, st]) => { setSessions(s); setSettings(st); })
      .finally(() => setLoading(false));
  }, []);

  const clubName = settings?.club_name || 'Volleyball Sdn Bhd';

  const openSessions = sessions.filter((s) => {
    const status = getSessionStatus(s, s.confirmed_count);
    return status === 'Available' || status === 'Almost Full';
  });

  const steps = [
    { icon: Calendar, title: t('landing.step1Title'), desc: t('landing.step1Desc') },
    { icon: Users, title: t('landing.step2Title'), desc: t('landing.step2Desc') },
    { icon: Heart, title: t('landing.step3Title'), desc: t('landing.step3Desc') },
  ];

  const rules = [t('landing.rule1'), t('landing.rule2'), t('landing.rule3'), t('landing.rule4'), t('landing.rule5'), t('landing.rule6')];
  const whyUsPoints = [
    t('landing.whyUsPoint1'), t('landing.whyUsPoint2'), t('landing.whyUsPoint3'),
    t('landing.whyUsPoint4'), t('landing.whyUsPoint5'), t('landing.whyUsPoint6'),
  ];
  const faqs = [
    { q: t('landing.faqQ1'), a: t('landing.faqA1', { clubName }) },
    { q: t('landing.faqQ2'), a: t('landing.faqA2') },
    { q: t('landing.faqQ3'), a: t('landing.faqA3') },
    { q: t('landing.faqQ4'), a: t('landing.faqA4', { whatsapp: settings?.contact_whatsapp || '0137441727' }) },
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative h-[520px] sm:h-[620px] overflow-hidden">
        <img src={heroImage} alt="Volleyball" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950/85 via-navy-900/70 to-navy-950/85" />

        <div className="relative h-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col justify-center">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-slate-200 text-sm font-medium mb-5 w-fit">
            {t('landing.badge', { clubName })}
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-white tracking-tight mb-4">
            {t('landing.titleLine1')} {t('landing.titleLine2')}
          </h1>
          <p className="text-base sm:text-lg text-slate-200 mb-8 max-w-2xl">
            {t('landing.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {profile ? (
              <Link to="/sessions" className="inline-flex items-center gap-2 px-7 py-3 bg-white hover:bg-slate-100 text-navy-900 font-semibold rounded-xl text-lg transition-colors">
                {t('landing.bookSession')} <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <Link to="/register" className="inline-flex items-center gap-2 px-7 py-3 bg-white hover:bg-slate-100 text-navy-900 font-semibold rounded-xl text-lg transition-colors">
                {t('landing.getStarted')} <ArrowRight className="h-5 w-5" />
              </Link>
            )}
            {settings?.whatsapp_group_link && (
              <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3 bg-white/10 backdrop-blur hover:bg-white/20 text-white font-bold rounded-xl text-lg border border-white/20 transition-colors">
                <MessageCircle className="h-5 w-5" /> {t('landing.joinWhatsappGroup')}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Open sessions */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <Reveal>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">{t('landing.openSessions')}</h2>
              <p className="text-slate-500 text-sm mt-1">{t('landing.openSessionsSubtitle')}</p>
            </div>
            {profile && (
              <Link to="/sessions" className="text-sm font-semibold text-navy-700 hover:underline">{t('landing.viewAll')}</Link>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-navy-600" /></div>
          ) : openSessions.length === 0 ? (
            <div className="text-center py-12 bg-navy-50 rounded-2xl border border-navy-100">
              <Calendar className="h-10 w-10 text-navy-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('landing.noOpenSessions')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {openSessions.slice(0, 6).map((s) => {
                const status = getSessionStatus(s, s.confirmed_count);
                const slotsLeft = s.maximum_capacity - s.confirmed_count;
                return (
                  <Link key={s.id} to={profile ? `/sessions/${s.id}` : '/register'}
                    className={`bg-white border shadow-sm rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all ${status === 'Almost Full' ? 'border-amber-300' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-slate-900">{s.title}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status === 'Almost Full' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {t(sessionStatusKeyMap[status] || status)}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-500">
                      <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {formatDate(s.session_date)}</div>
                      <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {formatTime(s.start_time)} - {formatTime(s.end_time)}</div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {s.venue_name}</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-lg font-semibold text-slate-900">{formatCurrency(s.price)}</span>
                      <span className={`text-sm font-bold ${slotsLeft <= 3 ? 'text-amber-600' : 'text-slate-600'}`}>
                        {t('common.slotsLeft', { count: slotsLeft })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        </Reveal>
      </section>

      {/* How it works + rules */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 bg-slate-50">
        <Reveal>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 text-center mb-8">{t('landing.howItWorks')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-center">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-navy-700 text-white mb-3">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-navy-600 mb-1">{t('landing.stepLabel', { number: i + 1 })}</div>
                  <h3 className="font-bold text-slate-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-slate-500">{step.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Session rules */}
          <div className="mt-8 bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5 text-navy-500" />
              <h3 className="font-bold text-slate-900">{t('landing.sessionRulesTitle')}</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600">
              {rules.map((rule) => (
                <p key={rule}>• {rule}</p>
              ))}
            </div>
          </div>
        </div>
        </Reveal>
      </section>

      {/* About with photo */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <Reveal>
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-8 items-center">
          <img src={aboutImage} alt="Volleyball players" className="rounded-2xl w-full h-64 object-cover shadow-lg" />
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-4">{t('landing.whyUsTitle', { clubName })}</h2>
            <ul className="space-y-2 text-slate-600">
              {whyUsPoints.map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 flex-shrink-0">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
        </Reveal>
      </section>

      {/* Contact + WhatsApp */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 bg-slate-50">
        <Reveal>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-4">{t('landing.getInTouch')}</h2>
          <p className="text-slate-500 mb-8">{t('landing.getInTouchSubtitle')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <a href={whatsappLink(settings?.contact_whatsapp || '0137441727', t('landing.contactWhatsappMessage', { clubName }))} target="_blank" rel="noopener noreferrer"
              className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 hover:shadow-lg transition-all text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600"><Phone className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold text-slate-900">{t('landing.contactPerson')}</p>
                  <p className="text-sm text-slate-500">{settings?.contact_person_name || 'Club Admin'}</p>
                </div>
              </div>
              <p className="text-sm text-green-600 font-medium">{t('landing.chatWithOnWhatsapp', { name: settings?.contact_person_name || 'us' })}</p>
            </a>
            <a href={settings?.whatsapp_group_link || '#'} target="_blank" rel="noopener noreferrer"
              className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 hover:shadow-lg transition-all text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600"><MessageCircle className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold text-slate-900">{t('landing.whatsappGroup')}</p>
                  <p className="text-sm text-slate-500">{t('landing.joinOurCommunity')}</p>
                </div>
              </div>
              <p className="text-sm text-green-600 font-medium">{t('landing.clickToJoinGroup')}</p>
            </a>
          </div>
        </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <Reveal>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 text-center mb-8">{t('landing.faqTitle')}</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
                <h3 className="font-bold text-slate-900 text-sm mb-1">{faq.q}</h3>
                <p className="text-slate-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 sm:px-6 bg-navy-900">
        <Reveal>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3">{t('landing.readyToPlay')}</h2>
          <p className="text-slate-300 mb-6">{t('landing.readyToPlaySubtitle', { clubName })}</p>
          <Link to={profile ? '/sessions' : '/register'}
            className="inline-flex items-center gap-2 px-7 py-3 bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl text-lg transition-all">
            {profile ? t('landing.browseSessions') : t('landing.startPlaying')} <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
        </Reveal>
      </section>
    </div>
  );
}
