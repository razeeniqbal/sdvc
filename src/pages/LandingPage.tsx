import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, ArrowRight, MessageCircle, Phone, Info, Sparkles, Zap, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { fetchSessionsWithCounts, getSessionStatus, type SessionWithCount } from '@/lib/sessions';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import type { ClubSettings } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

const heroImage = 'https://images.pexels.com/photos/6203569/pexels-photo-6203569.jpeg?auto=compress&cs=tinysrgb&w=1600';
const aboutImage = 'https://images.pexels.com/photos/6203525/pexels-photo-6203525.jpeg?auto=compress&cs=tinysrgb&w=1200';

export default function LandingPage() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSessionsWithCounts(), fetchClubSettings()])
      .then(([s, st]) => { setSessions(s); setSettings(st); })
      .finally(() => setLoading(false));
  }, []);

  const openSessions = sessions.filter((s) => {
    const status = getSessionStatus(s, s.confirmed_count);
    return status === 'Available' || status === 'Almost Full';
  });

  return (
    <div className="bg-gradient-to-b from-rose-50 via-white to-orange-50">
      {/* Hero */}
      <section className="relative h-[520px] sm:h-[620px] overflow-hidden">
        <img src={heroImage} alt="Volleyball" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-rose-900/80 via-slate-900/70 to-orange-900/80" />
        {/* Decorative anime-style elements */}
        <div className="absolute top-20 right-10 w-32 h-32 rounded-full bg-rose-500/20 blur-3xl animate-float" />
        <div className="absolute bottom-20 left-10 w-40 h-40 rounded-full bg-orange-400/20 blur-3xl animate-float" style={{ animationDelay: '1s' }} />

        <div className="relative h-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-rose-200 text-sm font-medium mb-5 w-fit">
            <Sparkles className="h-4 w-4 text-rose-300" />
            FunPlay Volleyball — for beginners!
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight mb-4">
            Play. Laugh.{' '}
            <span className="anime-text-gradient">Level Up.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-200 mb-8 max-w-2xl">
            Join our fun-first volleyball sessions designed for beginners. No pressure, no stress — just good vibes and good games.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {profile ? (
              <Link to="/sessions" className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl text-lg transition-all animate-pulse-glow">
                Book a Session <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <Link to="/register" className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl text-lg transition-all animate-pulse-glow">
                Get Started <ArrowRight className="h-5 w-5" />
              </Link>
            )}
            {settings?.whatsapp_group_link && (
              <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3 bg-white/10 backdrop-blur hover:bg-white/20 text-white font-bold rounded-xl text-lg border border-white/20 transition-colors">
                <MessageCircle className="h-5 w-5" /> Join WhatsApp Group
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Open sessions */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Zap className="h-6 w-6 text-rose-500" /> Open Sessions
              </h2>
              <p className="text-slate-500 text-sm mt-1">Grab your spot — they go fast!</p>
            </div>
            {profile && (
              <Link to="/sessions" className="text-sm font-semibold text-rose-600 hover:underline">View all</Link>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-rose-500" /></div>
          ) : openSessions.length === 0 ? (
            <div className="text-center py-12 bg-white/60 rounded-2xl border border-rose-100">
              <Calendar className="h-10 w-10 text-rose-200 mx-auto mb-3" />
              <p className="text-slate-500">No open sessions right now. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {openSessions.slice(0, 6).map((s) => {
                const status = getSessionStatus(s, s.confirmed_count);
                const slotsLeft = s.maximum_capacity - s.confirmed_count;
                return (
                  <Link key={s.id} to={profile ? `/sessions/${s.id}` : '/register'}
                    className={`glass-card rounded-2xl p-5 hover:shadow-xl hover:scale-[1.02] transition-all ${status === 'Almost Full' ? 'border-amber-300' : 'border-white/50'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-slate-900">{s.title}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status === 'Almost Full' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {status}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-500">
                      <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {formatDate(s.session_date)}</div>
                      <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {formatTime(s.start_time)} - {formatTime(s.end_time)}</div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {s.venue_name}</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xl font-bold text-slate-900">{formatCurrency(s.price)}</span>
                      <span className={`text-sm font-bold ${slotsLeft <= 3 ? 'text-amber-600' : 'text-slate-600'}`}>
                        {slotsLeft} slots left
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* How it works + rules */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 bg-gradient-to-r from-rose-50 to-orange-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-8 flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-rose-500" /> How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Calendar, title: 'Browse & Pick', desc: 'Choose a fun session that fits your schedule. All levels welcome!' },
              { icon: Users, title: 'Book & Pay', desc: 'Confirm your spot and pay. Simple, fast, secure.' },
              { icon: Heart, title: 'Show Up & Play', desc: 'Bring your energy! Arrive 10 min early and enjoy the game.' },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="glass-card rounded-2xl p-6 text-center">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-orange-400 text-white mb-3">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-rose-500 mb-1">Step {i + 1}</div>
                  <h3 className="font-bold text-slate-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-slate-500">{step.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Session rules */}
          <div className="mt-8 glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5 text-rose-400" />
              <h3 className="font-bold text-slate-900">Session Rules</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600">
              <p>• Arrive 10 minutes before the session starts.</p>
              <p>• Bring sports shoes, water bottle, and a towel.</p>
              <p>• Respect all players — we're here for fun!</p>
              <p>• No-shows may affect future booking priority.</p>
              <p>• All bookings are non-refundable.</p>
              <p>• Cancel at least 24h ahead to free your slot.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About with photo */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-8 items-center">
          <img src={aboutImage} alt="Volleyball players" className="rounded-2xl w-full h-64 object-cover shadow-lg" />
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Heart className="h-6 w-6 text-rose-500" /> Why FunPlay?
            </h2>
            <ul className="space-y-2 text-slate-600">
              {['Beginner-friendly, no experience needed', 'Fun-first atmosphere, no pressure', 'Real-time slot availability', 'Instant booking confirmation', 'Join our active WhatsApp community', 'Simple, fast, mobile-friendly booking'].map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 flex-shrink-0">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Contact + WhatsApp */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 bg-gradient-to-r from-rose-50 to-orange-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Get In Touch</h2>
          <p className="text-slate-500 mb-8">Questions? Message us or join the group chat!</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <a href={whatsappLink(settings?.contact_whatsapp || '0137441727', 'Hi, I have a question about FunPlay volleyball sessions.')} target="_blank" rel="noopener noreferrer"
              className="glass-card rounded-2xl p-6 hover:shadow-lg transition-all text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600"><Phone className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold text-slate-900">Contact Person</p>
                  <p className="text-sm text-slate-500">{settings?.contact_person_name || 'Club Admin'}</p>
                </div>
              </div>
              <p className="text-sm text-green-600 font-medium">WhatsApp: {settings?.contact_whatsapp || '0137441727'}</p>
            </a>
            <a href={settings?.whatsapp_group_link || '#'} target="_blank" rel="noopener noreferrer"
              className="glass-card rounded-2xl p-6 hover:shadow-lg transition-all text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600"><MessageCircle className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold text-slate-900">WhatsApp Group</p>
                  <p className="text-sm text-slate-500">Join our community</p>
                </div>
              </div>
              <p className="text-sm text-green-600 font-medium">Click to join the group chat</p>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-8">FAQ</h2>
          <div className="space-y-3">
            {[
              { q: 'Do I need experience?', a: 'Not at all! FunPlay is designed for beginners. Just bring your energy and willingness to learn.' },
              { q: 'Can I cancel my booking?', a: 'You can cancel up to 24 hours before the session to free up your slot. However, all bookings are non-refundable.' },
              { q: 'What if a session is full?', a: 'Join the waiting list. If a slot opens up, you will be notified and given 10 minutes to complete your booking.' },
              { q: 'How do I contact the club?', a: `Message us on WhatsApp at ${settings?.contact_whatsapp || '0137441727'} or join our WhatsApp group.` },
            ].map((faq, i) => (
              <div key={i} className="glass-card rounded-xl p-5">
                <h3 className="font-bold text-slate-900 text-sm mb-1">{faq.q}</h3>
                <p className="text-slate-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 sm:px-6 bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Ready to Play?</h2>
          <p className="text-slate-400 mb-6">Join the FunPlay community and book your first session today.</p>
          <Link to={profile ? '/sessions' : '/register'}
            className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl text-lg transition-all animate-pulse-glow">
            {profile ? 'Browse Sessions' : 'Start Playing'} <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
