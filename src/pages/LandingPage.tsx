import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageCircle, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { fetchSessionExtras, fetchSessionsWithCounts, getSessionStatus, type SessionExtras, type SessionWithCount } from '@/lib/sessions';
import { POSITION_ABBR, PLAYING_POSITIONS, SKILL_LEVELS, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import type { ClubSettings } from '@/types/database';
import { SessionCard } from '@/components/SessionCard';
import { PlayerCard } from '@/components/PlayerCard';
import { CourtLines } from '@/components/vsb/CourtLines';
import { FullWidthSection, SectionHeader } from '@/components/layout/Section';
import { MemberShortcuts } from '@/components/vsb/MemberShortcuts';
import { srcSet, vsbAssets } from '@/lib/vsbAssets';

// Illustrative VSB characters (production art, via the asset registry). They
// show the community's variety — never shown as, or in place of, real members.
// Tallest in the middle, like a team photo.
const LINEUP = [1, 4, 6, 0, 2, 3, 5].map((i) => vsbAssets.players[i].sm);

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
      {/* Signed in: your next game (pay now) and shortcuts come first */}
      {profile && <MemberShortcuts openCount={loading ? null : openSessions.length} />}

      {/* ===== HERO ===== */}
      {/* One <picture>: dedicated mobile art below 768px, desktop art above.
          ≥1024px the art is full-bleed and the copy sits on its dark left side;
          below that the copy stacks above the art. Eager + high priority — it's
          the first thing on screen. No text is baked into the artwork. */}
      <section className="relative overflow-hidden border-b border-ink-600">
        <div className="relative lg:flex lg:min-h-[max(34rem,calc(100svh-8.25rem))] lg:items-center">
          <div className="vsb-gutter relative z-10 -mb-[58vw] pt-10 md:-mb-[6vw] md:pt-14 lg:mb-0 lg:w-[50%] lg:py-10 xl:py-16">
            <p className="vsb-meta mb-5 !text-vsb-400">{t('v2.landing.eyebrow')}</p>
            <h1 className="vsb-display text-[clamp(3rem,12vw,4.5rem)] md:text-[clamp(4rem,8vw,5.5rem)] lg:text-[clamp(3.5rem,5.5vw,7rem)]">
              {t('v2.landing.heroLine1')}<br />
              {t('v2.landing.heroLine2')}<br />
              <span className="text-vsb-500">{t('v2.landing.heroLine3')}</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-300">
              {t('v2.landing.heroSub1')}<br />{t('v2.landing.heroSub2')}<br />{t('v2.landing.heroSub3')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={findGameTo} className="v2-btn-primary !px-8 !py-4 font-display text-lg uppercase tracking-wider">
                {t('v2.landing.findGame')} <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <Link to={whosPlayingTo} className="v2-btn-secondary !border-chalk/40 !bg-ink/80 !px-8 !py-4 font-display text-lg uppercase tracking-wider backdrop-blur-sm">
                {t('v2.landing.seeWhosPlaying')}
              </Link>
            </div>
          </div>
          <picture>
            <source media="(min-width: 768px)" sizes="100vw"
              srcSet={srcSet(vsbAssets.hero.desktop1280, vsbAssets.hero.desktop)}
              width={vsbAssets.hero.desktop.width} height={vsbAssets.hero.desktop.height} />
            <img
              src={vsbAssets.hero.mobile750.src}
              srcSet={srcSet(vsbAssets.hero.mobile750, vsbAssets.hero.mobile)}
              sizes="100vw"
              width={vsbAssets.hero.mobile.width}
              height={vsbAssets.hero.mobile.height}
              alt={t('v2.landing.heroAlt')}
              fetchPriority="high"
              decoding="async"
              className="hero-art relative block h-auto w-full lg:absolute lg:inset-0 lg:h-full lg:object-cover lg:object-right-bottom"
            />
          </picture>
          {/* readability: ink behind the copy on the left, fading into the art */}
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[62%] bg-gradient-to-r from-ink via-ink/75 to-transparent lg:block" aria-hidden />

        </div>

        {/* Hero metadata rail */}
        <div className="vsb-gutter relative grid grid-cols-2 border-t border-ink-600 bg-ink sm:grid-cols-4">
          {pillars.map((p, i) => (
            <p key={p} className={`py-4 font-display text-base font-bold uppercase tracking-[0.3em] text-chalk sm:py-5 ${i % 2 === 1 ? 'border-l border-ink-600 pl-6' : ''} ${i === 2 ? 'sm:border-l sm:border-ink-600 sm:pl-6' : ''}`}>
              <span className="text-vsb-500">0{i + 1}</span><span className="mx-2 text-muted" aria-hidden>/</span>{p}
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
        <div className="mt-8">
          {loading ? (
            <div role="status" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <span className="sr-only">{t('common.loading')}</span>
              {[0, 1, 2, 3].map((i) => <div key={i} className="vsb-skel h-[25rem] border border-ink-600" aria-hidden />)}
            </div>
          ) : featured.length === 0 ? (
            <div className="flex flex-wrap items-end justify-between gap-4 border-y border-ink-600 py-8">
              <div>
                <p className="font-display text-3xl font-bold uppercase text-chalk">{t('v2.landing.noSessionsTitle')}</p>
                <p className="mt-2 max-w-lg text-slate-400">{t('v2.sessions.newGamesWhere')}</p>
              </div>
              {settings?.whatsapp_group_link && (
                <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-green-400 hover:text-green-300">
                  <MessageCircle className="h-5 w-5" aria-hidden /> {t('landing.joinWhatsappGroup')}
                </a>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {featured.map((s) => (
                <SessionCard key={s.id} session={s} to={profile ? `/sessions/${s.id}` : '/register'}
                  roster={extras[s.id]?.roster} isPrivate={extras[s.id]?.isPrivate} />
              ))}
            </div>
          )}
        </div>
      </FullWidthSection>

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
          {LINEUP.map(({ src, width, height }, i) => (
            <img key={src} src={src} alt="" width={width} height={height} loading="lazy" decoding="async"
              className={`relative -mx-2 h-44 w-auto sm:-mx-3 sm:h-60 lg:-mx-4 lg:h-80 2xl:h-[26rem] ${i === 0 || i === 6 ? 'hidden sm:block' : ''}`}
              style={{ zIndex: 10 - Math.abs(i - 3) }} />
          ))}
        </div>
      </section>

      {/* ===== PLAYER IDENTITY ===== */}
      <section aria-labelledby="identity-heading" className="relative overflow-hidden border-t border-ink-600 bg-ink-850">
        <CourtLines opacity={0.05} />
        <div className="vsb-gutter relative grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div className="relative flex items-end justify-center gap-4 sm:gap-8">
            <img src={vsbAssets.players[5].full.src} alt="" width={vsbAssets.players[5].full.width} height={vsbAssets.players[5].full.height} loading="lazy" decoding="async"
              className="hidden h-[26rem] w-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] sm:block lg:h-[32rem]" />
            <div className="w-[17rem] sm:w-[19rem]">
              <PlayerCard name={t('v2.landing.cardName')} position={null} skill={null}
                games={null} artSrc={vsbAssets.players[0].sm.src} subtitle={t('v2.landing.cardSub')} />
            </div>
          </div>
          <div>
            <p className="vsb-meta mb-4 !text-vsb-400">{t('v2.landing.identityMeta')}</p>
            <h2 id="identity-heading" className="vsb-display text-5xl sm:text-6xl lg:text-7xl">
              {t('v2.landing.identityLine1')}<br /><span className="text-vsb-500">{t('v2.landing.identityLine2')}</span>
            </h2>
            <p className="mt-6 max-w-lg text-lg text-slate-300">{t('v2.landing.identityBody')}</p>
            <ul className="mt-6 max-w-lg space-y-2 text-slate-400">
              <li className="flex gap-3"><span className="mt-2.5 h-0.5 w-3 flex-shrink-0 bg-vsb-500" aria-hidden />{t('v2.landing.identityPoint1')}</li>
              <li className="flex gap-3"><span className="mt-2.5 h-0.5 w-3 flex-shrink-0 bg-vsb-500" aria-hidden />{t('v2.landing.identityPoint2')}</li>
              <li className="flex gap-3"><span className="mt-2.5 h-0.5 w-3 flex-shrink-0 bg-vsb-500" aria-hidden />{t('v2.landing.identityPoint3')}</li>
            </ul>
            <Link to={profile ? '/profile/player' : '/register'} className="v2-btn-primary mt-9 !px-8 !py-4 font-display text-lg uppercase tracking-wider">
              {t('v2.landing.createPlayer')} <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== GOOD TO KNOW: how it works, rules, FAQ, contact ===== */}
      <FullWidthSection divider labelledBy="faq-heading" className="bg-ink-850">
        <p className="vsb-meta mb-3">{t('v2.landing.goodToKnow')}</p>
        <div className="grid gap-14 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr]">
          <div>
            <h2 className="vsb-display text-4xl sm:text-5xl">{t('v2.landing.howVsbWorks')}</h2>
            <ol className="mt-6 divide-y divide-ink-600 border-y border-ink-600">
              {steps.map((step, i) => (
                <li key={step.title} className="flex gap-4 py-4">
                  <span className="font-display text-2xl font-extrabold leading-none text-vsb-500">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-display text-xl font-bold uppercase tracking-wide text-chalk">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="vsb-display text-4xl sm:text-5xl">{t('landing.sessionRulesTitle')}</h2>
            <ul className="mt-6 divide-y divide-ink-600 border-y border-ink-600 text-slate-300">
              {rules.map((rule) => <li key={rule} className="py-3">{rule}</li>)}
            </ul>
            <div className="mt-8 space-y-3">
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
          <div className="lg:col-span-2 xl:col-span-1">
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
      <section aria-labelledby="final-heading" className="vsb-gutter relative overflow-hidden border-t border-ink-600 py-16 lg:py-24">
        <span className="vsb-watermark -bottom-[0.18em] right-0" aria-hidden>{t('v2.landing.watermark')}</span>
        <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <h2 id="final-heading" className="vsb-display max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{t('v2.landing.finalTitle')}</h2>
          <Link to={findGameTo} className="v2-btn-primary !px-8 !py-4 font-display text-lg uppercase tracking-wider">
            {t('v2.landing.findGame')} <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
