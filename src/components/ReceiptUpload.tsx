import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, Upload, CheckCircle2, ZoomIn, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { bookingDisplayName, formatCurrency, formatDateTime } from '@/lib/format';
import { uploadReceipt, getReceiptSignedUrl } from '@/lib/receipts';
import { notifyReceiptUploaded } from '@/lib/notifications';
import type { Booking, Session, Profile } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

interface ReceiptUploadProps {
  booking: Booking;
  session: Session;
  profile: Profile;
  qrUrl?: string | null;
  /** Companion bookings made in the same checkout (including `booking` itself), if any. */
  groupBookings?: Booking[];
  onUploaded?: (path: string) => void;
}

export function ReceiptUpload({ booking, session, profile, qrUrl, groupBookings, onUploaded }: ReceiptUploadProps) {
  const { t } = useTranslation();
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [receiptPath, setReceiptPath] = useState(booking.receipt_path);
  const [uploadedAt, setUploadedAt] = useState(booking.receipt_uploaded_at);
  const [showQrLightbox, setShowQrLightbox] = useState(false);

  const party = groupBookings && groupBookings.length > 0 ? groupBookings : [booking];
  const totalAmount = party.reduce((sum, b) => sum + Number(b.total_amount), 0);

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
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      {session.price > 0 && qrUrl && (
        <div className="flex flex-col items-center mb-4 pb-4 border-b border-blue-200">
          <button
            type="button"
            onClick={() => setShowQrLightbox(true)}
            className="relative group rounded-lg overflow-hidden border border-blue-200"
          >
            <img src={qrUrl} alt="Payment QR code" className="w-40 h-40 object-contain bg-white p-2" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>
          <p className="flex items-center gap-1.5 text-sm text-blue-800 font-medium mt-2">
            <QrCode className="h-4 w-4" />
            {t('receipt.scanToPay')}
          </p>
          <button type="button" onClick={() => setShowQrLightbox(true)} className="text-xs text-blue-600 hover:underline mt-0.5">
            {t('receipt.tapToEnlarge')}
          </button>
        </div>
      )}

      <p className="font-semibold text-blue-900 text-sm mb-1">{t('receipt.title')}</p>
      <p className="text-xs text-blue-700 mb-3">{t('receipt.subtitle')}</p>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />

      {receiptPath && !uploading ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            {uploadedAt ? t('receipt.uploadedAt', { date: formatDateTime(uploadedAt) }) : t('receipt.uploaded')}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            {t('receipt.changeReceipt')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          {uploading ? t('receipt.uploading') : t('receipt.uploadButton')}
        </button>
      )}

      {/* QR lightbox */}
      {showQrLightbox && qrUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
          onClick={() => setShowQrLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setShowQrLightbox(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="h-7 w-7" />
          </button>
          <img
            src={qrUrl}
            alt="Payment QR code"
            className="w-full max-w-xs sm:max-w-sm bg-white rounded-2xl p-4 object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
