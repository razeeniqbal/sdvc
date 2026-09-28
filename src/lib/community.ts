import { supabase } from './supabase';
import { avatarPublicUrl } from './avatars';
import type { PlayingPosition, SkillLevel } from '@/types/database';

// Community rows come only from the `community_players` RPC, which returns
// public fields for members who haven't hidden themselves (plus you). No
// contact details, gender or role ever reach this page.
export interface CommunityPlayer {
  user_id: string;
  display_name: string;
  playing_position: PlayingPosition | null;
  skill_level: SkillLevel | null;
  avatar_url: string | null;
  games_played: number;
  member_since: string;
  next_session_id: string | null;
  next_session_title: string | null;
  next_session_date: string | null;
  is_me: boolean;
}

export async function fetchCommunity(): Promise<CommunityPlayer[]> {
  const { data, error } = await supabase.rpc('community_players');
  if (error) throw error;
  return ((data || []) as (Omit<CommunityPlayer, 'avatar_url'> & { avatar_thumb_path: string | null })[]).map(
    ({ avatar_thumb_path, ...p }) => ({ ...p, avatar_url: avatarPublicUrl(avatar_thumb_path) }),
  );
}

export async function setShowInCommunity(userId: string, show: boolean) {
  const { error } = await supabase.from('profiles').update({ show_in_community: show }).eq('id', userId);
  if (error) throw error;
}
