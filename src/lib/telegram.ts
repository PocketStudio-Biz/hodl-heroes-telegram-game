/* ------------------------------------------------------------------ */
/*  Telegram Mini Apps SDK wrapper                                     */
/*  Works inside Telegram and gracefully no-ops in a normal browser.   */
/* ------------------------------------------------------------------ */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const THEME_COLOR = '#0D0B1E';
const PLAYER_NAME_KEY = 'sanjiao_player_name';

/** True when running inside the Telegram Mini App host. */
export const isTelegram: boolean =
  typeof window !== 'undefined' && !!window.Telegram?.WebApp;

/** Internal accessor (may still be undefined in a browser). */
function getWebApp(): TelegramWebApp | undefined {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

/** Initialize the Mini App. Safe to call in any environment. */
export function initTelegram(): void {
  const webApp = getWebApp();
  if (!webApp) return;
  try {
    webApp.ready();
    webApp.expand();
    if (typeof webApp.setHeaderColor === 'function') {
      webApp.setHeaderColor(THEME_COLOR);
    } else {
      webApp.headerColor = THEME_COLOR;
    }
    if (typeof webApp.setBackgroundColor === 'function') {
      webApp.setBackgroundColor(THEME_COLOR);
    } else {
      webApp.backgroundColor = THEME_COLOR;
    }
    if (typeof webApp.disableClosingConfirmation === 'function') {
      webApp.disableClosingConfirmation();
    }
  } catch { /* never break the app */ }
}

/** Current player's display name + Telegram user id. */
export function getTelegramUser(): { name: string; id: number | null } {
  const user = getWebApp()?.initDataUnsafe?.user;
  if (user) {
    const name = user.username || user.first_name || 'Player';
    try { localStorage.setItem(PLAYER_NAME_KEY, name); } catch { /* ignore */ }
    return { name, id: user.id ?? null };
  }
  let cached: string | null = null;
  try { cached = localStorage.getItem(PLAYER_NAME_KEY); } catch { /* ignore */ }
  return { name: cached || 'Player', id: null };
}

/** Haptic feedback. No-op outside Telegram. */
export function haptic(style: HapticStyle = 'light'): void {
  const hf = getWebApp()?.HapticFeedback;
  if (!hf) return;
  try {
    if (style === 'success' || style === 'warning' || style === 'error') {
      hf.notificationOccurred(style);
    } else {
      hf.impactOccurred(style);
    }
  } catch { /* ignore */ }
}

/** Share score. Prefers Telegram share; falls back to clipboard. */
export function shareScore(score: number, round: number): void {
  const { name } = getTelegramUser();
  const appUrl = window.location.origin + window.location.pathname;
  const text = `${name} scored ${score.toLocaleString()} SAT and reached block ${round} in HODL HEROES! Can you beat it?`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(text)}`;
  const webApp = getWebApp();
  try {
    if (webApp?.switchInlineQuery) {
      webApp.switchInlineQuery(text, ['users', 'groups', 'channels']);
      return;
    }
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
      return;
    }
  } catch { /* fall through */ }
  const payload = `${text} ${appUrl}`;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(payload).catch(() => window.prompt('Copy your score:', payload));
  } else {
    window.prompt('Copy your score:', payload);
  }
}

/** Close the Mini App. */
export function closeApp(): void {
  const webApp = getWebApp();
  if (webApp) { try { webApp.close(); return; } catch { /* ignore */ } }
  window.history.back();
}

/** Stable viewport height. */
export function viewportHeight(): number {
  return getWebApp()?.viewportStableHeight || window.innerHeight;
}
