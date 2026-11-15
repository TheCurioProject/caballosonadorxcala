import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { resend } from "@/lib/resend";
import { DomainError, invariant } from "@/cala/domain/shared/errors";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";

/**
 * Team invitations for CALA.
 *
 * Supabase's built-in mailer is rate limited (a couple of emails per hour)
 * and its link lands on a page that cannot set a password, so CALA issues
 * its own one-time link instead: a random token whose SHA-256 is stored in
 * the invitee's app_metadata (writable by the service role only). Opening
 * the link lets the person choose a password; that confirms the email and
 * clears the token. The email goes out through Resend; when it can't be
 * sent the inviter gets the link to share by hand.
 */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Admin = ReturnType<typeof supabaseAdminClient>;
type PendingInvite = { hash: string; expiresAt: number };

const hashOf = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function pendingInviteOf(user: User): PendingInvite | null {
  const value = (user.app_metadata as Record<string, unknown> | undefined)
    ?.cala_invite as PendingInvite | undefined;
  return value && typeof value.hash === "string" ? value : null;
}

/** Link format: /admin/login/?invite=<userId>.<token> */
export function parseInvite(value: string) {
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32,64})$/.exec(value.trim());
  return match ? { userId: match[1], token: match[2] } : null;
}

/** Stores a fresh token (replacing any older one) and returns the link. */
export async function issueInvite(admin: Admin, user: User, origin: string) {
  const token = randomBytes(32).toString("base64url");
  const pending: PendingInvite = {
    hash: hashOf(token),
    expiresAt: Date.now() + INVITE_TTL_MS,
  };
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, cala_invite: pending },
  });
  invariant(
    !error,
    "INVITE_FAILED",
    "No se pudo preparar la invitación. Intenta de nuevo.",
    503,
  );
  const url = new URL("/admin/login/", origin);
  url.searchParams.set("invite", `${user.id}.${token}`);
  return url.toString();
}

/** Returns the invited user when the link is valid; throws otherwise. */
export async function checkInvite(admin: Admin, value: string) {
  const parsed = parseInvite(value);
  const invalid = () =>
    new DomainError(
      "INVITE_INVALID",
      "Este enlace de invitación ya no es válido. Pide que te inviten de nuevo.",
      400,
    );
  if (!parsed) throw invalid();
  const { data, error } = await admin.auth.admin.getUserById(parsed.userId);
  if (error || !data.user) throw invalid();
  const pending = pendingInviteOf(data.user);
  if (!pending) throw invalid();
  const expected = Buffer.from(pending.hash, "hex");
  const given = Buffer.from(hashOf(parsed.token), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    throw invalid();
  invariant(
    Date.now() <= pending.expiresAt,
    "INVITE_EXPIRED",
    "La invitación caducó. Pide que te inviten de nuevo.",
    400,
  );
  return data.user;
}

/** Sets the chosen password, confirms the email and burns the token. */
export async function acceptInvite(admin: Admin, user: User, password: string) {
  const metadata = { ...(user.app_metadata ?? {}) } as Record<string, unknown>;
  metadata.cala_invite = null;
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    app_metadata: metadata,
  });
  if (error) {
    const weak = /weak|password/i.test(error.message);
    throw new DomainError(
      weak ? "WEAK_PASSWORD" : "INVITE_FAILED",
      weak
        ? "Esa contraseña no es válida. Usa al menos 8 caracteres."
        : "No se pudo activar tu cuenta. Intenta de nuevo.",
      weak ? 400 : 503,
    );
  }
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

/** Emails the link. Returns false (never throws) when it couldn't be sent. */
export async function sendInviteEmail(input: {
  to: string;
  name: string;
  inviter: string;
  link: string;
  locale: "es" | "en";
}) {
  const copy =
    input.locale === "en"
      ? {
          subject: "Activate your CALA account · Casa Caballo Soñador",
          title: `Hi ${input.name}`,
          body: `${input.inviter} added you to the Casa Caballo Soñador team in CALA. To activate your account, press the button and choose your own password. After that you can sign in with your email and that password. The link is valid for 7 days and works only once.`,
          button: "Activate my account",
          ignore: "If you weren't expecting this email, you can ignore it: the account stays inactive.",
        }
      : {
          subject: "Activa tu cuenta de CALA · Casa Caballo Soñador",
          title: `Hola, ${input.name}`,
          body: `${input.inviter} te añadió al equipo de Casa Caballo Soñador en CALA. Para activar tu cuenta, pulsa el botón y elige tu propia contraseña. Después podrás iniciar sesión con tu correo y esa contraseña. El enlace es válido durante 7 días y sirve una sola vez.`,
          button: "Activar mi cuenta",
          ignore: "Si no esperabas este correo, puedes ignorarlo: la cuenta seguirá sin activar.",
        };
  if (!process.env.RESEND_API_KEY) {
    console.info(`[CALA invite] Enlace para ${input.to}: ${input.link}`);
    return false;
  }
  const from =
    process.env.CALA_EMAIL_FROM ||
    "CALA · Casa Caballo Soñador <no-reply@casacaballosonador.com>";
  try {
    const { error } = await resend.emails.send({
      from,
      to: [input.to],
      subject: copy.subject,
      text: `${copy.title}\n\n${copy.body}\n\n${input.link}\n\n${copy.ignore}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#23211F">
<div style="max-width:520px;margin:0 auto;padding:40px 20px">
<p style="margin:0 0 24px;font-size:12px;letter-spacing:.18em;color:#6b6259">CALA · CASA CABALLO SOÑADOR</p>
<div style="background:#fffdf8;border:1px solid #e6dfd2;border-radius:18px;padding:32px 24px">
<h1 style="margin:0 0 12px;font-size:22px;font-weight:600">${escapeHtml(copy.title)}</h1>
<p style="margin:0 0 28px;font-size:15px;line-height:1.5;color:#4d4740">${escapeHtml(copy.body)}</p>
<p style="margin:0;text-align:center"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#1f5f5b;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:999px">${escapeHtml(copy.button)}</a></p>
</div>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a8178">${escapeHtml(copy.ignore)}</p>
</div></body></html>`,
    });
    if (error) {
      console.error("[CALA invite] Resend error:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[CALA invite] Resend error:", error);
    return false;
  }
}
