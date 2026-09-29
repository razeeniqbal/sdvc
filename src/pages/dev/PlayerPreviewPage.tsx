import { useParams } from 'react-router-dom';
import { PreviewAuthProvider } from '@/context/AuthContext';
import type { Profile } from '@/types/database';
import ProfilePage from '@/pages/player/ProfilePage';
import MyBookingsPage from '@/pages/player/MyBookingsPage';
import CommunityPage from '@/pages/community/CommunityPage';
import SessionsPage from '@/pages/sessions/SessionsPage';
import LandingPage from '@/pages/LandingPage';
import { WhatsNew } from '@/components/vsb/WhatsNew';

// DEV-ONLY (route registered only when import.meta.env.DEV): player pages for a
// sample profile, to review layout and empty states without signing in.
// Queries run signed-out, so lists come back empty; nothing is written.
const SAMPLE: Profile = {
  id: '00000000-0000-4000-8000-00000000abcd', full_name: 'Jeen Tan', short_name: 'Jeen', email: '', phone_number: '0123456789',
  emergency_contact_name: null, emergency_contact_phone: null, gender: 'Female', playing_position: 'Flexible / Any Position',
  skill_level: 'Open Level', show_in_community: true, game_vibe: 'balanced', playstyle: 'all_rounder', experience_range: '1_3',
  play_reasons: ['social', 'improve'], player_pose: null, wears_glasses: null, seen_whats_new: '2026-10-rules-and-players', role: 'player', created_at: '2026-09-01T00:00:00Z', updated_at: '',
};

const PAGES = { myvsb: ProfilePage, games: MyBookingsPage, community: CommunityPage, sessions: SessionsPage, home: LandingPage } as const;

export default function PlayerPreviewPage() {
  const { page = 'myvsb' } = useParams<{ page: keyof typeof PAGES }>();
  const Page = PAGES[page] ?? ProfilePage;
  return (
    <PreviewAuthProvider profile={SAMPLE}>
      <p className="vsb-gutter border-b border-amber-500/40 bg-amber-500/10 py-2 text-sm text-amber-200">Dev-only preview · sample profile, signed-out data</p>
      <Page />
      {new URLSearchParams(window.location.search).has('whatsnew') && <WhatsNew preview />}
    </PreviewAuthProvider>
  );
}
