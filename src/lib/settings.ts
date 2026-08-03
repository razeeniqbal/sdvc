import { supabase } from './supabase';
import type { ClubSettings } from '@/types/database';

export async function fetchClubSettings(): Promise<ClubSettings | null> {
  const { data, error } = await supabase
    .from('club_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) return null;
  return data as ClubSettings;
}

export function whatsappLink(phone: string, message?: string): string {
  const clean = phone.replace(/[^0-9]/g, '');
  // Convert Malaysian numbers starting with 0 to +60
  const formatted = clean.startsWith('0') ? '60' + clean.slice(1) : clean;
  const base = `https://wa.me/${formatted}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
