import { supabase } from './supabase';

const RECEIPTS_BUCKET = 'payment-receipts';
const QR_BUCKET = 'club-assets';

// Stored under {user_id}/{booking_id}/{file} — the {user_id} prefix is what the
// storage RLS policy checks against auth.uid() to prove ownership.
export async function uploadReceipt(userId: string, bookingId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${bookingId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

// The bucket is private, so callers (the uploader or an admin) need a fresh signed URL
// each time they want to view or relay the image — permanent public links aren't issued.
export async function getReceiptSignedUrl(path: string, expiresInSeconds = 600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export async function uploadClubQrImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `payment-qr-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(QR_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from(QR_BUCKET).getPublicUrl(path).data.publicUrl;
}
