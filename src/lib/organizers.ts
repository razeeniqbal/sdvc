import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { OrganizerApplication, OrganizerPaymentProfile } from '@/types/database';

// Organizer role: members apply from My VSB, an admin reviews
// (review_organizer_application RPC sets the role). Organizers then run their
// own games in the console and get paid to their own QR.

const BUCKET = 'club-assets';

// ---------------------------------------------------------- applications ---
export async function fetchMyLatestApplication(userId: string): Promise<OrganizerApplication | null> {
  const { data } = await supabase.from('organizer_applications').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as OrganizerApplication) ?? null;
}

export async function applyToOrganize(userId: string, message: string) {
  const { error } = await supabase.from('organizer_applications').insert({ user_id: userId, message: message.trim() });
  if (error) throw error;
}

export interface PendingApplication extends OrganizerApplication {
  profile: { full_name: string; short_name: string | null; phone_number: string | null; email: string } | null;
}

export async function fetchPendingApplications(): Promise<PendingApplication[]> {
  const { data, error } = await supabase.from('organizer_applications')
    .select('*, profile:profiles!organizer_applications_user_id_fkey(full_name, short_name, phone_number, email)')
    .eq('status', 'pending').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as PendingApplication[];
}

export async function reviewApplication(id: string, approve: boolean) {
  const { error } = await supabase.rpc('review_organizer_application', { p_id: id, p_approve: approve });
  if (error) throw error;
}

// -------------------------------------------------------- payment profile ---
export async function fetchMyPaymentProfile(userId: string): Promise<OrganizerPaymentProfile | null> {
  const { data } = await supabase.from('organizer_payment_profiles').select('*').eq('user_id', userId).maybeSingle();
  return (data as OrganizerPaymentProfile) ?? null;
}

export async function saveMyPaymentProfile(userId: string, fields: Pick<OrganizerPaymentProfile, 'qr_path' | 'bank_name' | 'account_name' | 'account_number'>) {
  const { error } = await supabase.from('organizer_payment_profiles')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// QR codes are uploaded as-is (re-encoding can blur the modules and stop it scanning).
export async function uploadOrganizerQr(userId: string, file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Please use an image under 5 MB.');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `organizers/${userId}/qr-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'image/png', upsert: false });
  if (error) throw error;
  return path;
}

export function organizerQrUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null;
}

// ------------------------------------------------------- where to pay ---
export interface Payee {
  qrUrl: string | null;
  /** Set when paying an organizer rather than the club. */
  organizer: { name: string; bankName: string | null; accountName: string | null; accountNumber: string | null } | null;
}

// Organizer's QR for their games; the club QR otherwise.
export function useSessionPayee(sessionId: string | undefined, clubQrUrl: string | null | undefined): Payee {
  const [organizer, setOrganizer] = useState<{ qrUrl: string; name: string; bankName: string | null; accountName: string | null; accountNumber: string | null } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    supabase.rpc('session_payment_details', { p_session_id: sessionId }).then(({ data }) => {
      const row = (data as { qr_path: string; bank_name: string | null; account_name: string | null; account_number: string | null; organizer_name: string }[] | null)?.[0];
      if (!alive) return;
      setOrganizer(row ? { qrUrl: organizerQrUrl(row.qr_path)!, name: row.organizer_name, bankName: row.bank_name, accountName: row.account_name, accountNumber: row.account_number } : null);
    });
    return () => { alive = false; };
  }, [sessionId]);

  if (organizer) {
    const { qrUrl, ...rest } = organizer;
    return { qrUrl, organizer: rest };
  }
  return { qrUrl: clubQrUrl ?? null, organizer: null };
}
