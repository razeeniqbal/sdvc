import { useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

// VSB player identity (generated chibi avatars).
//   - player_avatars: one current avatar per player, readable by any signed-in user
//   - generation runs in the `generate-avatar` edge function, which enforces the
//     free-generation entitlement server-side; this module never decides it.

export interface PlayerAvatarRow {
  user_id: string;
  image_path: string;
  thumb_path: string;
  style_version: number;
  updated_at: string;
}

export interface AvatarUrls { image: string; thumb: string }

export function avatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('player-avatars').getPublicUrl(path).data.publicUrl;
}

function toUrls(row: PlayerAvatarRow | null): AvatarUrls | null {
  if (!row) return null;
  return { image: avatarPublicUrl(row.image_path)!, thumb: avatarPublicUrl(row.thumb_path)! };
}

// ---- The signed-in player's own avatar (tiny shared store so the navbar,
// My VSB and the create flow stay in sync after a generation) ----
const cache = new Map<string, AvatarUrls | null>();
const listeners = new Set<() => void>();

export async function refreshMyAvatar(userId: string) {
  const { data } = await supabase.from('player_avatars').select('*').eq('user_id', userId).maybeSingle();
  cache.set(userId, toUrls(data as PlayerAvatarRow | null));
  listeners.forEach((l) => l());
}

export function useMyAvatar(userId: string | undefined): AvatarUrls | null {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (userId && !cache.has(userId)) refreshMyAvatar(userId);
    return () => { listeners.delete(l); };
  }, [userId]);
  return userId ? cache.get(userId) ?? null : null;
}

// ---- Other players' avatars, for admin lists (thumbnails only) ----
export function useAvatarMap(userIds: string[]): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  const key = [...new Set(userIds)].sort().join(',');
  useEffect(() => {
    if (!key) { setMap(new Map()); return; }
    const ids = key.split(',');
    // Chunk to keep the URL well under PostgREST limits.
    Promise.all(
      Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) =>
        supabase.from('player_avatars').select('user_id, thumb_path').in('user_id', ids.slice(i * 150, i * 150 + 150)))
    ).then((results) => {
      const m = new Map<string, string>();
      results.forEach(({ data }) => (data || []).forEach((r: { user_id: string; thumb_path: string }) => m.set(r.user_id, avatarPublicUrl(r.thumb_path)!)));
      setMap(m);
    });
  }, [key]);
  return map;
}

// ---- Entitlement (display only — enforced by the edge function) ----
export interface Entitlement { allowed: number; used: number; remaining: number; unlimited: boolean }

export async function fetchMyEntitlement(): Promise<Entitlement | null> {
  const { data, error } = await supabase.rpc('my_avatar_entitlement');
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as Entitlement;
}

// ---- Generation ----
export type GenerationErrorCode =
  | 'NOT_CONFIGURED' | 'NO_GENERATIONS_LEFT' | 'IN_PROGRESS' | 'BAD_STYLE' | 'GENERATION_FAILED' | 'UPLOAD_FAILED' | 'NETWORK' | 'UNKNOWN';

export class GenerationError extends Error {
  constructor(public code: GenerationErrorCode, message: string) { super(message); }
}

// The approved style reference ships with the app; the edge function verifies
// its SHA-256, so it can't be swapped for a different image.
const STYLE_REFERENCE_URL = '/brand/avatar-style-v1.webp';

// Uploads the cropped photo + style reference to the player's private folder,
// then asks the edge function to generate. One idempotency key per attempt:
// retrying the same attempt can never use a second generation.
export async function generateMyAvatar(userId: string, photo: Blob): Promise<void> {
  const key = crypto.randomUUID();
  const sourcePath = `${userId}/${key}.jpg`;
  const stylePath = `${userId}/${key}-style.webp`;

  const styleBlob = await fetch(STYLE_REFERENCE_URL).then((r) => (r.ok ? r.blob() : Promise.reject()))
    .catch(() => { throw new GenerationError('BAD_STYLE', 'Style reference unavailable'); });

  const [up1, up2] = await Promise.all([
    supabase.storage.from('player-sources').upload(sourcePath, photo, { contentType: 'image/jpeg', upsert: false }),
    supabase.storage.from('player-sources').upload(stylePath, styleBlob, { contentType: 'image/webp', upsert: false }),
  ]);
  if (up1.error || up2.error) {
    await supabase.storage.from('player-sources').remove([sourcePath, stylePath]);
    throw new GenerationError('UPLOAD_FAILED', up1.error?.message || up2.error?.message || 'Upload failed');
  }

  const { data, error } = await supabase.functions.invoke('generate-avatar', {
    body: { source_path: sourcePath, style_path: stylePath, idempotency_key: key },
  });
  if (error) {
    let code: GenerationErrorCode = 'UNKNOWN';
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.code) code = body.code;
      if (body?.error) message = body.error;
    } else {
      code = 'NETWORK';
    }
    throw new GenerationError(code, message);
  }
  if (data?.status !== 'succeeded') throw new GenerationError('UNKNOWN', 'Generation did not complete');
  await refreshMyAvatar(userId);
}
