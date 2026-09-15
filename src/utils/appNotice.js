export const APP_NOTICE_EVENT = 'tme-app-notice';

const NOTICE_TONES = new Set(['success', 'error', 'warning', 'info']);

export const showAppNotice = (message, tone = 'info', options = {}) => {
  if (typeof window === 'undefined' || !message) return false;
  window.dispatchEvent(new CustomEvent(APP_NOTICE_EVENT, {
    detail: {
      id: Date.now(),
      message: String(message),
      tone: NOTICE_TONES.has(tone) ? tone : 'info',
      duration: Number.isFinite(options.duration) ? Math.max(1200, options.duration) : undefined,
    },
  }));
  return true;
};
