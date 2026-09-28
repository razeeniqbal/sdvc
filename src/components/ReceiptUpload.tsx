import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, CheckCircle2, ZoomIn, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { bookingDisplayName, formatCurrency, formatDateTime } from '@/lib/format';
import { uploadReceipt, getReceiptSignedUrl } from '@/lib/receipts';
import { notifyReceiptUploaded } from '@/lib/notifications';
import { useSessionPayee } from '@/lib/organizers';
import type { Booking, Session, Profile } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

interface ReceiptUploadProps {
  booking: Booking;
  session: Session;
  profile: Profile;
  /** Club QR. Games created by an organizer use that organizer's QR instead. */
  qrUrl?: string | null;
  /** Companion bookings made in the same checkout (including `booking` itself), if any. */
  groupBookings?: Booking[];
  onUploaded?: (path: string) => void;
}

export function ReceiptUpload({ booking, session, profile, qrUrl: clubQrUrl, groupBookings, onUploaded }: ReceiptUploadProps) {
  const { t } = useTranslation();
  const { qrUrl, organizer } = useSessionPayee(session.id, clubQrUrl);
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [receiptPath, setReceiptPath] = useState(booking.receipt_path);
  const [uploadedAt, setUploadedAt] = useState(booking.receipt_uploaded_at);
  const [showQrLightbox, setShowQrLightbox] = useState(false);

  const party = groupBookings && groupBookings.length > 0 ? groupBookings : [booking];
  // Unpaid bookings follow the session's current price rather than the stale snapshot
  // taken when the slot was locked, so a price finalized after booking (e.g. a TBC
  // session) doesn't leave the payer looking at the wrong amount to pay.
  const totalAmount = party.reduce((sum, b) => sum + (b.payment_status !== 'Paid' ? session.price : Number(b.total_amount)), 0);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadReceipt(profile.id, booking.id, file);
      const now = new Date().toISOString();
      // One receipt covers the whole party, so stamp every booking in the group —
      // otherwise the companion rows would show no proof of payment in the admin panel.
      if (booking.booking_group_id) {
        await supabase.from('bookings').update({ receipt_path: path, receipt_uploaded_at: now }).eq('booking_group_id', booking.booking_group_id);
      } else {
        await supabase.from('bookings').update({ receipt_path: path, receipt_uploaded_at: now }).eq('id', booking.id);
      }
      setReceiptPath(path);
      setUploadedAt(now);
      onUploaded?.(path);

      const signedUrl = await getReceiptSignedUrl(path, 600);
      if (signedUrl) {
        const name = bookingDisplayName(booking, profile);
        const playerLine = party.length > 1
          ? `Players: ${party.map((b) => bookingDisplayName(b, profile)).join(', ')}`
          : `Player: ${name}`;
        await notifyReceiptUploaded(
          signedUrl,
          `💰 Payment receipt uploaded\nBooking: ${booking.booking_reference}\n${playerLine}\nSession: ${session.title}\nAmount: ${formatCurrency(totalAmount)}`,
          booking.id
        );
      }
      show(t('receipt.uploaded'), 'success');
    } catch {
      show(t('receipt.error'), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="border-y border-ink-600">
      {session.price > 0 && qrUrl && (
        <div className="flex flex-col gap-5 border-b border-ink-700 py-5 sm:flex-row sm:items-start">
          <button type="button" onClick={() => setShowQrLightbox(true)} aria-label={t('receipt.tapToEnlarge')}
            className="group relative flex-shrink-0 self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400">
            <img src={qrUrl} alt={t('receipt.qrAlt')} className="h-44 w-44 bg-white object-contain p-2" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
              <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </span>
          </button>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold uppercase tracking-wide text-chalk"><span className="mr-2 text-vsb-500">01</span>{t('receipt.scanToPay')}</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-chalk">{formatCurrency(totalAmount)}</p>
            {organizer && (
              <div className="mt-2 text-sm">
                <p className="text-slate-300">{t('v2.organizer.payTo', { name: organizer.name })}</p>
                {(organizer.bankName || organizer.accountNumber) && (
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    {[organizer.bankName, organizer.accountName, organizer.accountNumber].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            )}
            <button type="button" onClick={() => setShowQrLightbox(true)} className="mt-2 text-sm font-semibold text-vsb-400 hover:text-vsb-300">
              {t('receipt.tapToEnlarge')}
            </button>
          </div>
        </div>
      )}

      <div className="py-5">
        <p className="font-display text-xl font-bold uppercase tracking-wide text-chalk">
          {session.price > 0 && qrUrl && <span className="mr-2 text-vsb-500">02</span>}{t('receipt.title')}
        </p>
        <p className="mb-4 mt-1 text-sm text-slate-400">{t('receipt.subtitle')}</p>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} aria-label={t('receipt.uploadButton')} />

        {receiptPath && !uploading ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-green-400" role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {uploadedAt ? t('receipt.uploadedAt', { date: formatDateTime(uploadedAt) }) : t('receipt.uploaded')}
            </p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold text-vsb-400 hover:text-vsb-300">
              {t('receipt.changeReceipt')}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="v2-btn-primary">
            {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" aria-hidden />}
            {uploading ? t('receipt.uploading') : t('receipt.uploadButton')}
          </button>
        )}
      </div>

      {/* QR lightbox */}
      {showQrLightbox && qrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setShowQrLightbox(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowQrLightbox(false); }} role="dialog" aria-modal="true" aria-label={t('receipt.qrAlt')}>
          <button type="button" autoFocus onClick={() => setShowQrLightbox(false)} aria-label={t('common.close')} className="absolute right-4 top-4 text-white/80 hover:text-white">
            <X className="h-7 w-7" aria-hidden />
          </button>
          <img src={qrUrl} alt={t('receipt.qrAlt')} className="w-full max-w-xs bg-white object-contain p-4 sm:max-w-sm" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
