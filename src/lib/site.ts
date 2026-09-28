// Public address of the player app, used in links we send out (Telegram,
// WhatsApp). Override per environment with VITE_SITE_URL.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://vsb.madebyrazeen.com').replace(/\/$/, '');

export const bookingLink = (bookingId: string) => `${SITE_URL}/bookings/${bookingId}`;
export const sessionLink = (sessionId: string) => `${SITE_URL}/sessions/${sessionId}`;
