export function normalizePhone(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, '');
  return clean.startsWith('0') ? '60' + clean.slice(1) : clean;
}

// Supabase Auth is email-based; phone-only accounts use a deterministic
// synthetic email derived from the phone number so no real email is needed.
export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@phone.volleyballsdnbhd.local`;
}
