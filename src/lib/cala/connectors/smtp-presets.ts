/** SMTP servers CALA knows for the host's mailbox (shared by server and assistant). */
export type SmtpPreset = {
  host: string;
  port: number;
  provider: "google" | "yahoo" | "icloud";
  label: string;
  /** Where the host creates the app password. */
  appPasswordUrl: string;
};

const google = { host: "smtp.gmail.com", port: 465, provider: "google", appPasswordUrl: "https://myaccount.google.com/apppasswords" } as const;
const presets: [RegExp, SmtpPreset][] = [
  // TELUS e-mail runs on Google Workspace since the migration: Google's SMTP + app password.
  [/^(telus\.net|telusplanet\.net)$/, { ...google, label: "TELUS (Google)" }],
  [/^(gmail|googlemail)\.com$/, { ...google, label: "Gmail" }],
  [/^(yahoo|ymail|rocketmail)\.[a-z.]+$/, { host: "smtp.mail.yahoo.com", port: 465, provider: "yahoo", label: "Yahoo", appPasswordUrl: "https://login.yahoo.com/account/security/app-passwords" }],
  [/^(icloud|me|mac)\.com$/, { host: "smtp.mail.me.com", port: 587, provider: "icloud", label: "iCloud", appPasswordUrl: "https://account.apple.com/account/manage" }],
];

export function smtpPreset(email: string): SmtpPreset | null {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return presets.find(([re]) => re.test(domain))?.[1] ?? null;
}
