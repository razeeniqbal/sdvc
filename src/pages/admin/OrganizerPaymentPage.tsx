import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Save, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { fetchMyPaymentProfile, organizerQrUrl, saveMyPaymentProfile, uploadOrganizerQr } from '@/lib/organizers';
import { AdminPageHeader, SectionTitle } from '@/components/admin/AdminUI';
import { Spinner } from '@/components/LoadingScreen';

// Organizer console: where players pay for this organizer's games. Players see
// this QR (and the bank details, if filled in) at checkout for any game the
// organizer created. Without a QR, the club's QR is shown instead.

export default function OrganizerPaymentPage() {
  const { profile } = useAuth();
  const { show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qrPath, setQrPath] = useState<string | null>(null);
  const [form, setForm] = useState({ bank_name: '', account_name: '', account_number: '' });

  useEffect(() => {
    if (!profile) return;
    fetchMyPaymentProfile(profile.id).then((p) => {
      if (p) {
        setQrPath(p.qr_path);
        setForm({ bank_name: p.bank_name ?? '', account_name: p.account_name ?? '', account_number: p.account_number ?? '' });
      }
      setLoading(false);
    });
  }, [profile]);

  async function persist(nextQr: string | null) {
    if (!profile) return;
    await saveMyPaymentProfile(profile.id, {
      qr_path: nextQr,
      bank_name: form.bank_name.trim() || null,
      account_name: form.account_name.trim() || null,
      account_number: form.account_number.trim() || null,
    });
  }

  async function handleUpload(file: File | undefined) {
    if (!file || !profile) return;
    setUploading(true);
    try {
      const path = await uploadOrganizerQr(profile.id, file);
      await persist(path);
      setQrPath(path);
      show('Payment QR saved. Players will see it at checkout for your games.', 'success');
    } catch (err) {
      show((err as Error).message, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await persist(qrPath);
      show('Payment details saved', 'success');
    } catch (err) {
      show((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>;

  const qrUrl = organizerQrUrl(qrPath);
  const label = 'mb-1.5 block text-sm font-medium text-slate-300';

  return (
    <div className="adm-page max-w-4xl">
      <AdminPageHeader meta="Organizer" title="Payment QR" subtitle="Players pay you directly for the games you create. Upload your DuitNow or bank QR." />

      <section className="mt-8" aria-labelledby="qr-heading">
        <SectionTitle id="qr-heading">Your QR code</SectionTitle>
        <div className="flex flex-wrap items-end gap-6">
          {qrUrl ? (
            <img src={qrUrl} alt="Your payment QR code" className="h-48 w-48 bg-white object-contain p-2" />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center border border-dashed border-ink-500 px-4 text-center text-sm text-muted">
              No QR yet. Players will see the club QR until you add yours.
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} disabled={uploading} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="adm-btn !py-2.5">
              {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" aria-hidden />}
              {uploading ? 'Uploading…' : qrUrl ? 'Replace QR code' : 'Upload QR code'}
            </button>
            <p className="mt-2 max-w-xs text-xs text-muted">Use a clear, uncropped image of the QR so it scans first time.</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="mt-10" aria-labelledby="bank-heading">
        <SectionTitle id="bank-heading">Bank details (optional)</SectionTitle>
        <p className="mb-4 max-w-2xl text-sm text-slate-400">Shown under your QR, for players who prefer a transfer.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="bank" className={label}>Bank</label>
            <input id="bank" className="v2-input !py-2.5 !text-base" maxLength={100} value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. Maybank" />
          </div>
          <div>
            <label htmlFor="acct-name" className={label}>Account name</label>
            <input id="acct-name" className="v2-input !py-2.5 !text-base" maxLength={100} value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="acct-no" className={label}>Account number</label>
            <input id="acct-no" className="v2-input !py-2.5 !text-base" maxLength={40} inputMode="numeric" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
          </div>
        </div>
        <button type="submit" disabled={saving} className="v2-btn-primary mt-5 font-display uppercase tracking-wider">
          {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" aria-hidden />} {saving ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </div>
  );
}
