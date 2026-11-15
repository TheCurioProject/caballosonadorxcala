"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalaLogo } from "@/cala/components/brand/cala-logo";
import { LanguageToggle } from "@/cala/components/ui/language-toggle";
import { useI18n } from "@/cala/lib/i18n";
import { api } from "./context";

type Mode = "signin" | "invite";

/** Eye icon – show/hide password */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

/** Password field with show/hide toggle */
function PasswordInput({
  name,
  autoComplete,
  minLength,
  placeholder,
  required = true,
}: {
  name: string;
  autoComplete: string;
  minLength?: number;
  placeholder?: string;
  required?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        maxLength={256}
        minLength={minLength}
        placeholder={placeholder}
        style={{ flex: 1, paddingRight: "2.5rem" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("Ocultar contraseña") : t("Mostrar contraseña")}
        style={{
          position: "absolute",
          right: "0.6rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#9b8b7d",
          display: "flex",
          alignItems: "center",
          padding: "0.25rem",
          lineHeight: 1,
        }}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}

export function WelcomeAuth({
  onAuthenticated,
}: {
  onAuthenticated: () => void;
}) {
  const { t } = useI18n();
  // CALA is invitation-only: there is no self sign-up here. New people get a
  // link from Equipo y permisos (/admin/login/?invite=…) and only choose a
  // password; the account and its access were created by the inviter.
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [invite, setInvite] = useState<{
    token: string;
    email: string;
    name: string;
  } | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token) return;
    let active = true;
    api<{ invite: { email: string; name: string } }>("/api/session", {
      method: "POST",
      body: JSON.stringify({ action: "invite_info", invite: token }),
    })
      .then((result) => {
        if (!active) return;
        setInvite({ token, ...result.invite });
        setMode("invite");
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo abrir la invitación.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "invite" && invite) {
        const password = form.get("password") as string;
        if (password !== form.get("confirm")) {
          setError(t("Las contraseñas no coinciden."));
          return;
        }
        await api("/api/session", {
          method: "POST",
          body: JSON.stringify({
            action: "invite_accept",
            invite: invite.token,
            password,
          }),
        });
        window.history.replaceState(null, "", window.location.pathname);
        setInvite(null);
        onAuthenticated();
        return;
      }
      await api("/api/session", {
        method: "POST",
        body: JSON.stringify({
          action: "signin",
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      onAuthenticated();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("No se pudo completar la operación."),
      );
    } finally {
      setBusy(false);
    }
  }

  const inviting = mode === "invite" && invite;

  return (
    <main className="welcome-auth">
      <section className="auth-story">
        <CalaLogo inverse />
        <div className="auth-story-copy">
          <p className="eyebrow">CASA CABALLO SOÑADOR</p>
          <h1>{t("Tu operación, en calma.")}</h1>
          <p>{t("Reservas, huéspedes y equipo en un solo espacio.")}</p>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-form-card" onSubmit={handleSubmit}>
          <div className="auth-form-top">
            <CalaLogo />
            <LanguageToggle />
          </div>

          <h2 style={{ marginBottom: "0.1rem" }}>
            {inviting ? t("Activa tu cuenta") : t("Accede a tu panel")}
          </h2>
          <p style={{ marginTop: 0, marginBottom: "1.25rem" }}>
            {inviting
              ? t("Te invitaron al equipo de Casa Caballo Soñador. Elige una contraseña para entrar.")
              : t("Usa la cuenta autorizada para este alojamiento.")}
          </p>

          {/* ── Correo (fijo cuando viene de una invitación) ── */}
          <label>
            {t("Correo electrónico")}
            {inviting ? (
              <input
                name="email"
                type="email"
                autoComplete="username"
                value={invite.email}
                readOnly
              />
            ) : (
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                maxLength={255}
                placeholder="correo@ejemplo.com"
              />
            )}
          </label>

          {/* ── Contraseña ── */}
          <label>
            {t("Contraseña")}
            <PasswordInput
              name="password"
              autoComplete={inviting ? "new-password" : "current-password"}
              minLength={inviting ? 8 : undefined}
              placeholder={inviting ? t("Mínimo 8 caracteres") : undefined}
            />
          </label>

          {inviting && (
            <label>
              {t("Confirmar contraseña")}
              <PasswordInput
                name="confirm"
                autoComplete="new-password"
                minLength={8}
                placeholder={t("Repite tu contraseña")}
              />
            </label>
          )}

          {error && (
            <p className="notice error" role="alert">{error}</p>
          )}

          <button
            className="button primary full"
            disabled={busy}
            style={{ marginTop: "0.25rem" }}
          >
            {busy
              ? inviting
                ? t("Activando…")
                : t("Entrando…")
              : inviting
                ? t("Activar y entrar")
                : t("Iniciar sesión")}
          </button>

          <p className="helper" style={{ marginTop: "0.75rem" }}>
            {inviting
              ? t("Después entrarás con tu correo y esta contraseña.")
              : t("El acceso es solo por invitación. Si no tienes cuenta o necesitas recuperar el acceso, contacta al administrador.")}
          </p>
          <Link href="/es/">{t("Volver a la web")}</Link>
        </form>
      </section>
    </main>
  );
}
