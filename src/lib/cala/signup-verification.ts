import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { resend } from "@/lib/resend";
import { invariant } from "@/cala/domain/shared/errors";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";

/**
 * Email confirmation for CALA sign-up.
 *
 * The account is created unconfirmed and WITHOUT organization access. A
 * 6-digit code is emailed with Resend; only its HMAC is stored, in the user's
 * app_metadata (writable by the service role only). Access to the property is
 * granted after the code is verified, so an unverified account can never open
 * the panel.
 */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

type Pending = {
  hash: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
};
type Admin = ReturnType<typeof supabaseAdminClient>;

function secret() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  invariant(key, "SUPABASE_NOT_CONFIGURED", "Falta configurar Supabase.", 503);
  return key;
}
function digest(userId: string, code: string) {
  return createHmac("sha256", secret())
    .update(`cala-signup:${userId}:${code}`)
    .digest("hex");
}
export function pendingOf(user: User): Pending | null {
  const value = (user.app_metadata as Record<string, unknown> | undefined)
    ?.cala_signup as Pending | undefined;
  return value && typeof value.hash === "string" ? value : null;
}

/** Supabase has no lookup by email in the admin API: page through users. */
export async function findUserByEmail(admin: Admin, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    invariant(
      !error,
      "SIGNUP_FAILED",
      "No se pudo verificar el registro. Intenta de nuevo.",
      503,
    );
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Generates a new code, stores its hash and emails it. */
export async function issueCode(
  admin: Admin,
  user: User,
  locale: "es" | "en",
) {
  const previous = pendingOf(user);
  invariant(
    !previous || Date.now() - previous.sentAt >= RESEND_COOLDOWN_MS,
    "CODE_COOLDOWN",
    "Espera un minuto antes de pedir otro código.",
    429,
  );
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();
  const pending: Pending = {
    hash: digest(user.id, code),
    expiresAt: now + CODE_TTL_MS,
    sentAt: now,
    attempts: 0,
  };
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, cala_signup: pending },
  });
  invariant(
    !error,
    "SIGNUP_FAILED",
    "No se pudo preparar la verificación. Intenta de nuevo.",
    503,
  );
  await sendCodeEmail(user.email!, code, locale);
}

/** Checks the code. Wrong codes count towards MAX_ATTEMPTS. */
export async function checkCode(admin: Admin, user: User, code: string) {
  const pending = pendingOf(user);
  invariant(
    pending,
    "CODE_MISSING",
    "Solicita un código nuevo para confirmar tu correo.",
    400,
  );
  invariant(
    pending.attempts < MAX_ATTEMPTS,
    "CODE_LOCKED",
    "Demasiados intentos. Solicita un código nuevo.",
    429,
  );
  invariant(
    Date.now() <= pending.expiresAt,
    "CODE_EXPIRED",
    "El código caducó. Solicita uno nuevo.",
    400,
  );
  const expected = Buffer.from(pending.hash, "hex");
  const given = Buffer.from(digest(user.id, code), "hex");
  const valid =
    expected.length === given.length && timingSafeEqual(expected, given);
  if (!valid) {
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...user.app_metadata,
        cala_signup: { ...pending, attempts: pending.attempts + 1 },
      },
    });
    invariant(
      false,
      "CODE_INVALID",
      "El código no es correcto. Revisa el correo e inténtalo de nuevo.",
      400,
    );
  }
}

/** Marks the email as confirmed and removes the stored code. */
export async function confirmEmail(admin: Admin, user: User) {
  const metadata = { ...(user.app_metadata ?? {}) } as Record<string, unknown>;
  metadata.cala_signup = null;
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    app_metadata: metadata,
  });
  invariant(
    !error,
    "SIGNUP_FAILED",
    "No se pudo confirmar el correo. Intenta de nuevo.",
    503,
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

async function sendCodeEmail(to: string, code: string, locale: "es" | "en") {
  const copy =
    locale === "en"
      ? {
          subject: `${code} is your CALA confirmation code`,
          title: "Confirm your email",
          body: "Enter this code in CALA to finish creating your account. It expires in 10 minutes.",
          ignore:
            "If you didn't try to create a CALA account, you can ignore this email.",
        }
      : {
          subject: `${code} es tu código de confirmación de CALA`,
          title: "Confirma tu correo",
          body: "Escribe este código en CALA para terminar de crear tu cuenta. Caduca en 10 minutos.",
          ignore:
            "Si no intentaste crear una cuenta en CALA, puedes ignorar este correo.",
        };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Local development without Resend: show the code in the server log so
    // the flow can still be tested. Production must have the key.
    invariant(
      process.env.NODE_ENV !== "production",
      "EMAIL_NOT_CONFIGURED",
      "No se pudo enviar el código. Contacta al administrador.",
      503,
    );
    console.info(`[CALA signup] Código para ${to}: ${code}`);
    return;
  }
  const from =
    process.env.CALA_EMAIL_FROM ||
    "CALA · Casa Caballo Soñador <no-reply@casacaballosonador.com>";
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: copy.subject,
    text: `${copy.title}\n\n${code}\n\n${copy.body}\n\n${copy.ignore}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#23211F">
<div style="max-width:520px;margin:0 auto;padding:40px 20px">
<p style="margin:0 0 24px;font-size:12px;letter-spacing:.18em;color:#6b6259">CALA · CASA CABALLO SOÑADOR</p>
<div style="background:#fffdf8;border:1px solid #e6dfd2;border-radius:18px;padding:32px 24px">
<h1 style="margin:0 0 12px;font-size:22px;font-weight:600">${escapeHtml(copy.title)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4d4740">${escapeHtml(copy.body)}</p>
<p style="margin:0;font-size:34px;font-weight:700;letter-spacing:.32em;text-align:center;color:#1f5f5b;font-family:Menlo,Consolas,monospace">${code}</p>
</div>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a8178">${escapeHtml(copy.ignore)}</p>
</div></body></html>`,
  });
  if (error) console.error("[CALA signup] Resend error:", error.message);
  invariant(
    !error,
    "EMAIL_FAILED",
    "No se pudo enviar el código. Intenta de nuevo en unos minutos.",
    503,
  );
}
