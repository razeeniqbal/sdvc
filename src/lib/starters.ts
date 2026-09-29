import { supabase } from './supabase';

// Starting players: members an admin (or the session's organizer) books
// straight in as confirmed places with no payment (add_session_starters RPC).
export interface Starter { id: string; name: string; position: string | null }

export async function addStarters(sessionId: string, userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const { data, error } = await supabase.rpc('add_session_starters', { p_session_id: sessionId, p_user_ids: userIds });
  if (error) throw error;
  return (data as number) ?? 0;
}
