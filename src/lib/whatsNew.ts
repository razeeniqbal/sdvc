// Reopen the "What's new" announcement on demand (player menu). WhatsNew
// listens for this event; nothing is saved by opening it.
export const WHATS_NEW_EVENT = 'vsb:open-whats-new';

export function openWhatsNew() {
  window.dispatchEvent(new Event(WHATS_NEW_EVENT));
}
