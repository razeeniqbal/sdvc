import { supabase } from './supabase';
import { vsbAssets } from './vsbAssets';

// Session court photos live in the public `club-assets` bucket:
//   admins      → sessions/{uuid}.webp
//   organizers  → organizers/{their user id}/sessions/{uuid}.webp
// (storage policies only let each role write to its own prefix).

const BUCKET = 'club-assets';
const MAX_EDGE = 1600;

export const DEFAULT_COURT_IMAGE = vsbAssets.court.horizontal1024.src;
const DEFAULT_COURT_IMAGE_LG = vsbAssets.court.horizontal.src;

export function sessionCoverUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Photo for a session card/hero: the uploaded court photo, else VSB court art
// (`lg` for full-width heroes, default size for cards).
export function sessionImage(path: string | null | undefined, size: 'md' | 'lg' = 'md'): string {
  return sessionCoverUrl(path) ?? (size === 'lg' ? DEFAULT_COURT_IMAGE_LG : DEFAULT_COURT_IMAGE);
}

// Resize in the browser (phone photos are often 4000px+) and store as WebP.
async function toWebp(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/webp', 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadSessionCover(file: File, opts: { userId: string; isAdmin: boolean }): Promise<string> {
  const blob = await toWebp(file);
  const name = `${crypto.randomUUID()}.webp`;
  const path = opts.isAdmin ? `sessions/${name}` : `organizers/${opts.userId}/sessions/${name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return path;
}
