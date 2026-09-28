import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageCircle, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { fetchSessionExtras, fetchSessionsWithCounts, getSessionStatus, type SessionExtras, type SessionWithCount } from '@/lib/sessions';
import { POSITION_ABBR, PLAYING_POSITIONS, SKILL_LEVELS, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import type { ClubSettings } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';
import { SessionCard } from '@/components/SessionCard';
import { PlayerCard } from '@/components/PlayerCard';
import { CourtLines } from '@/components/vsb/CourtLines';
import { FullWidthSection, SectionHeader } from '@/components/layout/Section';

// Illustrative VSB characters (approved marketing art, public/brand/players).
// They represent the community's variety — they are never shown as, or in place
// of, real members.
// Intrinsic sizes are declared so the lineup never shifts layout while loading.
const PLAYER_SIZES: Record<number, [number, number]> = {
  1: [274, 542], 2: [274, 528], 3: [251, 533], 4: [254, 511], 5: [230, 539],
  6: [209, 469], 7: [230, 475], 8: [218, 449], 9: [257, 469], 10: [229, 457],
};
const LINEUP = [2, 3, 1, 4, 5, 7, 8, 6, 9, 10].map((n) => ({
  src: `/brand/players/player-${String(n).padStart(2, '0')}.webp`,
  w: PLAYER_SIZES[n][0],
  h: PLAYER_SIZES[n][1],
}));

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
  });
  const featured = openSessions.slice(0, 4);

  const openIds = featured.map((s) => s.id).join(',');
  useEffect(() => {
    if (!profile || !openIds) return;
    fetchSessionExtras(openIds.split(',')).then(setExtras).catch(() => {});
  }, [profile, openIds]);

  const findGameTo = profile ? '/sessions' : '/register';
  const whosPlayingTo = profile ? (featured[0] ? `/sessions/${featured[0].id}` : '/sessions') : '/register';

  const steps = [
    { title: t('v2.landing.step1Title'), desc: t('v2.landing.step1Desc') },
    { title: t('v2.landing.step2Title'), desc: t('v2.landing.step2Desc') },
    { title: t('v2.landing.step3Title'), desc: t('v2.landing.step3Desc') },
  ];
  const pillars = [t('v2.landing.pillarPeople'), t('v2.landing.pillarPlay'), t('v2.landing.pillarConnect'), t('v2.landing.pillarBelong')];
  const rules = [t('landing.rule1'), t('landing.rule2'), t('landing.rule3'), t('landing.rule4'), t('landing.rule5'), t('landing.rule6')];
  const faqs = [
    { q: t('landing.faqQ1'), a: t('landing.faqA1', { clubName }) },
    { q: t('landing.faqQ2'), a: t('landing.faqA2') },
    { q: t('landing.faqQ3'), a: t('landing.faqA3') },
    { q: t('landing.faqQ4'), a: t('landing.faqA4', { whatsapp: settings?.contact_whatsapp || '0137441727' }) },
  ];

  return (
    <div className="bg-ink text-chalk">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b border-ink-600 lg:flex lg:min-h-[calc(100svh-4rem)] lg:flex-col">
        <CourtLines opacity={0.06} />

        {/* Mobile / tablet art — stacked above the copy */}
        <picture className="block lg:hidden">
          <source media="(min-width: 640px)" srcSet="/brand/hero-desktop.webp" width={1112} height={520} />
          <img src="/brand/hero-mobile.webp" width={308} height={408} alt={t('v2.landing.heroAlt')}
            className="block aspect-[308/408] max-h-[58svh] w-full object-cover object-top sm:aspect-[1112/520] sm:max-h-none" />
        </picture>

        <div className="relative flex flex-1 flex-col">
        {/* Desktop art — standing on the metadata rail at the right edge, fading into ink */}
        <img
          src="/brand/hero-desktop.webp"
          width={1112}
          height={520}
          alt={t('v2.landing.heroAlt')}
          className="absolute bottom-0 right-0 hidden w-[min(calc((100vw-40rem)/0.86),1700px)] lg:block"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent 8%, #000 34%), linear-gradient(to bottom, transparent 0%, #000 20%)',
            WebkitMaskComposite: 'source-in',
            maskImage: 'linear-gradient(to right, transparent 8%, #000 34%), linear-gradient(to bottom, transparent 0%, #000 20%)',
            maskComposite: 'intersect',
          }}
        />

        <div className="vsb-gutter relative flex flex-1 flex-col justify-center py-10 lg:py-16">
          <div className="max-w-[46rem]">
            <p className="vsb-meta mb-6 !text-vsb-400">{t('v2.landing.eyebrow')}</p>
            <h1 className="vsb-display text-[clamp(3.25rem,7.5vw,7.5rem)]">
              {t('v2.landing.heroLine1')}<br />
              {t('v2.landing.heroLine2')}<br />
              <span className="text-vsb-500">{t('v2.landing.heroLine3')}</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-300">
              {t('v2.landing.heroSub1')}<br />{t('v2.landing.heroSub2')}<br />{t('v2.landing.heroSub3')}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to={findGameTo} className="v2-btn-primary !px-8 !py-4 font-display text-lg uppercase tracking-wider">
                {t('v2.landing.findGame')} <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <Link to={whosPlayingTo} className="v2-btn-secondary !px-8 !py-4 font-display text-lg uppercase tracking-wider">
                {t('v2.landing.seeWhosPlaying')}
              </Link>
            </div>
          </div>
        </div>

        </div>

        {/* Hero metadata rail */}
        <div className="vsb-gutter relative grid grid-cols-2 border-t border-ink-600 bg-ink sm:grid-cols-4">
          {pillars.map((p, i) => (
            <p key={p} className={`py-4 font-display text-base font-bold uppercase tracking-[0.3em] text-chalk sm:py-5 ${i % 2 === 1 ? 'border-l border-ink-600 pl-6' : ''} ${i === 2 ? 'sm:border-l sm:border-ink-600 sm:pl-6' : ''}`}>
              <span className="mr-3 text-vsb-500">0{i + 1}</span>{p}
            </p>
          ))}
        </div>
      </section>

      {/* ===== NEXT ON COURT ===== */}
      <FullWidthSection labelledBy="next-on-court">
        <SectionHeader
          id="next-on-court"
          meta={t('v2.landing.nextMeta')}
          title={t('v2.landing.nextOnCourt')}
          aside={profile && openSessions.length > 0 && (
            <Link to="/sessions" className="inline-flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wider text-vsb-400 hover:text-vsb-300">
              {t('v2.landing.allSessions', { count: openSessions.length })} <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          )}
        />
        <div className="mt-10">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-vsb-500" /></div>
          ) : featured.length === 0 ? (
            <div className="border-y border-ink-600 py-14">
              <p className="font-display text-3xl font-bold uppercase text-chalk">{t('v2.landing.noSessionsTitle')}</p>
              <p className="mt-2 max-w-lg text-slate-400">{t('landing.noOpenSessions')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {featured.map((s) => (
                <SessionCard key={s.id} session={s} to={profile ? `/sessions/${s.id}` : '/register'}
                  roster={extras[s.id]?.roster} isPrivate={extras[s.id]?.isPrivate} />
              ))}
            </div>
          )}
        </div>
      </FullWidthSection>

      {/* ===== HOW VSB WORKS ===== */}
      <FullWidthSection id="how-it-works" divider labelledBy="how-heading" className="scroll-mt-16">
        <SectionHeader id="how-heading" meta={t('v2.landing.howMeta')} title={t('v2.landing.howVsbWorks')} />
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0">
          {steps.map((step, i) => (
            <li key={i} className={`border-t border-ink-500 pt-6 md:pr-10 ${i > 0 ? 'md:border-l md:pl-10' : ''}`}>
              <span className="font-display text-7xl font-extrabold leading-none text-vsb-500 lg:text-8xl">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-5 font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-chalk">{step.title}</h3>
              <p className="mt-3 max-w-sm text-slate-400">{step.desc}</p>
            </li>
          ))}
        </ol>
      </FullWidthSection>

      {/* ===== PLAYER IDENTITY ===== */}
      <section aria-labelledby="identity-heading" className="relative overflow-hidden border-t border-ink-600 bg-ink-850">
        <CourtLines opacity={0.05} />
        <div className="vsb-gutter relative grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div className="relative flex items-end justify-center gap-4 sm:gap-8">
            <img src="/brand/players/player-01.webp" alt="" width={274} height={542} loading="lazy"
              className="hidden h-[26rem] w-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] sm:block lg:h-[32rem]" />
            <div className="w-[17rem] sm:w-[19rem]">
              <PlayerCard name={t('v2.landing.cardName')} position={null} skill={null} gender={null} joinedAt={null}
                stats={null} artSrc="/brand/players/player-01.webp" subtitle={t('v2.landing.cardSub')} />
            </div>
          </div>
          <div>
            <p className="vsb-meta mb-4 !text-vsb-400">{t('v2.landing.identityMeta')}</p>
            <h2 id="identity-heading" className="vsb-display text-5xl sm:text-6xl lg:text-7xl">
              {t('v2.landing.identityLine1')}<br /><span className="text-vsb-500">{t('v2.landing.identityLine2')}</span>
            </h2>
            <p className="mt-6 max-w-lg text-lg text-slate-300">{t('v2.landing.identityBody')}</p>
            <ul className="mt-6 max-w-lg space-y-2 text-slate-400">
              <li className="flex gap-3"><span className="text-vsb-500" aria-hidden>—</span>{t('v2.landing.identityPoint1')}</li>
              <li className="flex gap-3"><span className="text-vsb-500" aria-hidden>—</span>{t('v2.landing.identityPoint2')}</li>
              <li className="flex gap-3"><span className="text-vsb-500" aria-hidden>—</span>{t('v2.landing.identityPoint3')}</li>
            </ul>
            <Link to={profile ? '/profile#card' : '/register'} className="v2-btn-primary mt-9 !px-8 !py-4 font-display text-lg uppercase tracking-wider">
              {t('v2.landing.createPlayer')} <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== COMMUNITY ===== */}
      <section aria-labelledby="community-heading" className="relative overflow-hidden border-t border-ink-600">
        <div className="vsb-gutter grid gap-8 pt-16 lg:grid-cols-[1fr_1fr] lg:items-end lg:pt-24">
          <div>
            <p className="vsb-meta mb-4">{t('v2.landing.communityMeta')}</p>
            <h2 id="community-heading" className="vsb-display text-5xl sm:text-6xl lg:text-7xl">
              {t('v2.landing.communityLine1')}<br />{t('v2.landing.communityLine2')}
            </h2>
          </div>
          <div className="space-y-5 lg:pb-2">
            <p className="max-w-xl text-lg text-slate-300">{t('v2.landing.communityBody')}</p>
            <div>
              <p className="vsb-meta mb-2">{t('v2.landing.everyPosition')}</p>
              <p className="flex flex-wrap gap-2">
                {PLAYING_POSITIONS.map((p) => (
                  <span key={p} className="border border-ink-500 px-2.5 py-1 font-display text-sm font-bold tracking-wider text-chalk">{POSITION_ABBR[p]}</span>
                ))}
              </p>
            </div>
            <div>
              <p className="vsb-meta mb-2">{t('v2.landing.everyLevel')}</p>
              <p className="flex flex-wrap gap-x-5 gap-y-1 font-display text-lg font-bold uppercase tracking-wider text-slate-300">
                {SKILL_LEVELS.map((l) => <span key={l}>{t(SKILL_LEVEL_KEY[l])}</span>)}
              </p>
            </div>
          </div>
        </div>
        {/* Lineup: overlapping, reaching the bottom edge like a team photo */}
        <div className="relative mt-10 flex items-end justify-center overflow-hidden px-2" aria-hidden>
          {LINEUP.map(({ src, w, h }, i) => (
            <img key={src} src={src} alt="" width={w} height={h} loading="lazy"
              className={`relative -mx-3 h-40 w-auto sm:-mx-4 sm:h-56 lg:-mx-5 lg:h-72 2xl:-mx-6 2xl:h-96 ${i >= 6 ? 'hidden lg:block' : ''}`}
              style={{ zIndex: 10 - Math.round(Math.abs(i - 4.5)) }} />
          ))}
        </div>
      </section>

      {/* ===== UTILITY: rules, FAQ, contact ===== */}
      <FullWidthSection divider labelledBy="faq-heading" className="bg-ink-850">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="vsb-meta mb-3">{t('v2.landing.goodToKnow')}</p>
            <h2 className="vsb-display text-4xl sm:text-5xl">{t('landing.sessionRulesTitle')}</h2>
            <ul className="mt-6 space-y-3 text-slate-300">
              {rules.map((rule) => <li key={rule} className="flex gap-3"><span className="text-vsb-500" aria-hidden>—</span>{rule}</li>)}
            </ul>
            <div className="mt-10 space-y-3">
              <a href={whatsappLink(settings?.contact_whatsapp || '0137441727', t('landing.contactWhatsappMessage', { clubName }))} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-slate-200 hover:text-white">
                <Phone className="h-5 w-5 text-green-400" aria-hidden />
                {t('landing.chatWithOnWhatsapp', { name: settings?.contact_person_name || 'us' })}
              </a>
              {settings?.whatsapp_group_link && (
                <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-200 hover:text-white">
                  <MessageCircle className="h-5 w-5 text-green-400" aria-hidden />
                  {t('landing.joinWhatsappGroup')}
                </a>
              )}
            </div>
          </div>
          <div>
            <h2 id="faq-heading" className="vsb-display text-4xl sm:text-5xl">{t('landing.faqTitle')}</h2>
            <div className="mt-6 divide-y divide-ink-600 border-y border-ink-600">
              {faqs.map((faq, i) => (
                <details key={i} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-chalk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400">
                    {faq.q}
                    <span className="text-2xl text-vsb-500 transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-slate-400">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </FullWidthSection>

      {/* ===== FINAL CTA ===== */}
      <section className="vsb-gutter relative overflow-hidden border-t border-ink-600 py-16 lg:py-24">
        <CourtLines opacity={0.05} />
        <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <h2 className="vsb-display text-5xl sm:text-6xl lg:text-7xl">
            {t('v2.landing.heroLine1')}<br />{t('v2.landing.heroLine2')}<br /><span className="text-vsb-500">{t('v2.landing.heroLine3')}</span>
          </h2>
          <Link to={findGameTo} className="v2-btn-primary !px-8 !py-4 font-display text-lg uppercase tracking-wider">
            {t('v2.landing.findGame')} <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
