// Preferences are optional: browser privacy settings must not block the workspace.
type PreferenceKey =
  | "cala-scope"
  | "cala-theme"
  | "cala-density"
  | "cala-font-size"
  | "cala-locale";

/** Interface language lives in a cookie (not the database): the server reads
 *  it to render CALA in that language from the first paint, and it survives
 *  sign-out so the sign-in screen opens in the chosen language. */
export const LOCALE_COOKIE = "cala-locale";
const COOKIE_KEYS = new Set<PreferenceKey>([LOCALE_COOKIE]);
const YEAR = 60 * 60 * 24 * 365;

function readCookie(key: string): string | null {
  try {
    const match = document.cookie
      .split("; ")
      .find((part) => part.startsWith(key + "="));
    return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
  } catch {
    return null;
  }
}
function writeCookie(key: string, value: string | null) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      value === null
        ? `${key}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
        : `${key}=${encodeURIComponent(value)}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
  } catch {
    // Cookies disabled: the choice still applies to this session.
  }
}

export const browserPreferences = {
  getItem(key: PreferenceKey): string | null {
    if (COOKIE_KEYS.has(key)) {
      const value = readCookie(key);
      if (value !== null) return value;
      // Older versions stored the language in localStorage: keep honouring
      // it until the next change moves it to the cookie.
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: PreferenceKey, value: string): void {
    if (COOKIE_KEYS.has(key)) {
      writeCookie(key, value);
      // Drop the copy older versions kept in localStorage.
      try {
        window.localStorage.removeItem(key);
      } catch {}
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The current view still works when preferences cannot be persisted.
    }
  },
  removeItem(key: PreferenceKey): void {
    if (COOKIE_KEYS.has(key)) writeCookie(key, null);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Unavailable storage does not prevent falling back to the default scope.
    }
  },
};
