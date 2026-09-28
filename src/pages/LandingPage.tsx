import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageCircle, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { fetchSessionExtras, fetchSessionsWithCounts, getSessionStatus, type SessionExtras, type SessionWithCount } from '@/lib/sessions';
import type { ClubSettings } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';
import { SessionCard } from '@/components/SessionCard';

export default function LandingPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [extras, setExtras] = useState<Record<string, SessionExtras>>({});
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
  }).slice(0, 6);

  const openIds = openSessions.map((s) => s.id).join(',');
  useEffect(() => {
    if (!profile || !openIds) return;
    fetchSessionExtras(openIds.split(',')).then(setExtras).catch(() => {});
  }, [profile, openIds]);

  const findGameTo = profile ? '/sessions' : '/register';

  const steps = [
    { title: t('landing.step1Title'), desc: t('landing.step1Desc') },
    { title: t('landing.step2Title'), desc: t('landing.step2Desc') },
    { title: t('landing.step3Title'), desc: t('landing.step3Desc') },
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
    <div className="bg-ink text-chalk">
      {/* Hero — copy is live text, never baked into the artwork (PRD §7). */}
      <section className="relative overflow-hidden border-b border-ink-600">
        {/* Stacked above the copy below lg; beside it (right ~62%) from lg up, with
            a left-edge fade so the artwork meets the ink background softly. */}
        <picture>
          <source media="(min-width: 768px)" srcSet="/brand/hero-desktop.webp" width={1112} height={520} />
          <img
            src="/brand/hero-mobile.webp"
            width={308}
            height={408}
            alt={t('v2.landing.heroAlt')}
            className="block w-full object-cover object-top aspect-[308/408] max-h-[52vh] md:aspect-[1112/520] md:max-h-none
              lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-[62%] lg:aspect-auto lg:object-center
              lg:[mask-image:linear-gradient(to_right,transparent,black_22%)]"
          />
        </picture>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-24">
          <div className="max-w-lg">
            <p className="mb-4 font-display text-sm font-bold uppercase tracking-[0.25em] text-vsb-400">{t('v2.landing.eyebrow')}</p>
            <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-chalk sm:text-6xl lg:text-7xl">
              {t('v2.landing.heroLine1')}<br />
              {t('v2.landing.heroLine2')}<br />
              <span className="text-vsb-500">{t('v2.landing.heroLine3')}</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-slate-300 sm:text-lg">{t('v2.landing.heroSubtitle')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={findGameTo} className="v2-btn-primary !px-7 !py-3 text-lg">
                {t('v2.landing.findGame')} <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <a href="#how-it-works" className="v2-btn-secondary !px-7 !py-3 text-lg">{t('v2.landing.seeHowItWorks')}</a>
            </div>
            {settings?.whatsapp_group_link && (
              <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-green-400 hover:text-green-300">
                <MessageCircle className="h-4 w-4" aria-hidden /> {t('landing.joinWhatsappGroup')}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Upcoming sessions */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="v2-heading text-3xl sm:text-4xl">{t('v2.landing.upcomingSessions')}</h2>
              <p className="mt-1 text-sm text-slate-400">{t('landing.openSessionsSubtitle')}</p>
            </div>
            {profile && (
              <Link to="/sessions" className="flex-shrink-0 text-sm font-semibold text-vsb-400 hover:text-vsb-300">{t('landing.viewAll')}</Link>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-vsb-500" /></div>
          ) : openSessions.length === 0 ? (
            <div className="v2-surface py-12 text-center">
              <p className="text-slate-400">{t('landing.noOpenSessions')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {openSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  to={profile ? `/sessions/${s.id}` : '/register'}
                  roster={extras[s.id]?.roster}
                  isPrivate={extras[s.id]?.isPrivate}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works + rules */}
      <section id="how-it-works" className="scroll-mt-16 border-y border-ink-600 bg-ink-850 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="v2-heading mb-8 text-3xl sm:text-4xl">{t('v2.landing.howVsbWorks')}</h2>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={i} className="v2-surface p-6">
                <span className="font-display text-5xl font-extrabold leading-none text-vsb-500">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 font-display text-xl font-bold uppercase tracking-wide text-chalk">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{step.desc}</p>
              </li>
            ))}
          </ol>

          <div className="v2-surface mt-6 p-6">
            <h3 className="mb-4 font-display text-xl font-bold uppercase tracking-wide text-chalk">{t('landing.sessionRulesTitle')}</h3>
            <ul className="grid gap-x-8 gap-y-2 text-sm text-slate-300 sm:grid-cols-2">
              {rules.map((rule) => (
                <li key={rule} className="flex gap-2"><span className="text-vsb-500" aria-hidden>—</span>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Why VSB */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_1.4fr] md:items-start">
          <h2 className="v2-heading text-3xl sm:text-4xl">{t('landing.whyUsTitle', { clubName })}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {whyUsPoints.map((b) => (
              <li key={b} className="border-l-2 border-vsb-500 pl-3 text-slate-300">{b}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Contact + WhatsApp */}
      <section className="border-t border-ink-600 bg-ink-850 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="v2-heading text-3xl sm:text-4xl">{t('landing.getInTouch')}</h2>
          <p className="mb-6 mt-1 text-slate-400">{t('landing.getInTouchSubtitle')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a href={whatsappLink(settings?.contact_whatsapp || '0137441727', t('landing.contactWhatsappMessage', { clubName }))} target="_blank" rel="noopener noreferrer"
              className="v2-surface flex items-center gap-4 p-5 transition-colors hover:border-green-500">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/15 text-green-400"><Phone className="h-5 w-5" aria-hidden /></span>
              <span>
                <span className="block font-semibold text-chalk">{t('landing.contactPerson')} · {settings?.contact_person_name || 'Club Admin'}</span>
                <span className="block text-sm text-green-400">{t('landing.chatWithOnWhatsapp', { name: settings?.contact_person_name || 'us' })}</span>
              </span>
            </a>
            {settings?.whatsapp_group_link && (
              <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer"
                className="v2-surface flex items-center gap-4 p-5 transition-colors hover:border-green-500">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/15 text-green-400"><MessageCircle className="h-5 w-5" aria-hidden /></span>
                <span>
                  <span className="block font-semibold text-chalk">{t('landing.whatsappGroup')}</span>
                  <span className="block text-sm text-green-400">{t('landing.clickToJoinGroup')}</span>
                </span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="v2-heading mb-6 text-3xl sm:text-4xl">{t('landing.faqTitle')}</h2>
          <div className="divide-y divide-ink-600 border-y border-ink-600">
            {faqs.map((faq, i) => (
              <details key={i} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-chalk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400">
                  {faq.q}
                  <span className="text-xl text-vsb-500 transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-sm text-slate-400">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-ink-600 px-4 py-14 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="v2-heading text-3xl sm:text-4xl">{t('v2.landing.finalTitle')}</h2>
            <p className="mt-1 text-slate-400">{t('landing.readyToPlaySubtitle', { clubName })}</p>
          </div>
          <Link to={findGameTo} className="v2-btn-primary !px-7 !py-3 text-lg">
            {t('v2.landing.findGame')} <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
