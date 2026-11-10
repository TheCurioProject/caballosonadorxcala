// Preferences are optional: browser privacy settings must not block the workspace.
type PreferenceKey =
  | "cala-scope"
  | "cala-theme"
  | "cala-density"
  | "cala-font-size"
  | "cala-locale";

export const browserPreferences = {
  getItem(key: PreferenceKey): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: PreferenceKey, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The current view still works when preferences cannot be persisted.
    }
  },
  removeItem(key: PreferenceKey): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Unavailable storage does not prevent falling back to the default scope.
    }
  },
};
