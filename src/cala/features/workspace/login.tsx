"use client";
import Link from "next/link";
import { useState } from "react";
import { CalaLogo } from "@/cala/components/brand/cala-logo";
import { api } from "./context";

type Mode = "signin" | "signup";

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
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
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
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "signup") {
        const password = form.get("password") as string;
        const confirm = form.get("confirm") as string;
        if (password !== confirm) {
          setError("Las contraseñas no coinciden.");
          return;
        }
        await api("/api/session", {
          method: "POST",
          body: JSON.stringify({
            action: "signup",
            email: form.get("email"),
            password,
            name: form.get("name") || undefined,
          }),
        });
      } else {
        await api("/api/session", {
          method: "POST",
          body: JSON.stringify({
            action: "signin",
            email: form.get("email"),
            password: form.get("password"),
          }),
        });
      }
      onAuthenticated();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo completar la operación.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="welcome-auth">
      <section className="auth-story">
        <CalaLogo inverse />
        <div className="auth-story-copy">
          <p className="eyebrow">CASA CABALLO SOÑADOR</p>
          <h1>Tu operación, en calma.</h1>
          <p>Reservas, huéspedes y equipo en un solo espacio.</p>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-form-card" onSubmit={handleSubmit}>
          <CalaLogo />

          <h2 style={{ marginBottom: "0.1rem" }}>
            {mode === "signin" ? "Accede a tu panel" : "Crea tu cuenta CALA"}
          </h2>
          <p style={{ marginTop: 0, marginBottom: "1.25rem" }}>
            {mode === "signin"
              ? "Usa la cuenta autorizada para este alojamiento."
              : "Regístrate para acceder al panel de Casa Caballo Soñador."}
          </p>

          {/* ── Signup-only: nombre ── */}
          {mode === "signup" && (
            <label>
              Nombre (opcional)
              <input
                name="name"
                type="text"
                autoComplete="name"
                maxLength={120}
                placeholder="Tu nombre"
              />
            </label>
          )}

          {/* ── Correo ── */}
          <label>
            Correo electrónico
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              maxLength={255}
              placeholder="correo@ejemplo.com"
            />
          </label>

          {/* ── Contraseña ── */}
          <label>
            Contraseña
            <PasswordInput
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : undefined}
              placeholder={mode === "signup" ? "Mínimo 8 caracteres" : undefined}
            />
          </label>

          {/* ── Confirmar contraseña (signup) ── */}
          {mode === "signup" && (
            <label>
              Confirmar contraseña
              <PasswordInput
                name="confirm"
                autoComplete="new-password"
                minLength={8}
                placeholder="Repite tu contraseña"
              />
            </label>
          )}

          {/* ── Mensajes ── */}
          {error && (
            <p className="notice error" role="alert">{error}</p>
          )}
          {success && (
            <p className="notice success" role="status">{success}</p>
          )}

          {/* ── Botón principal ── */}
          <button className="button primary full" disabled={busy} style={{ marginTop: "0.25rem" }}>
            {busy
              ? mode === "signup" ? "Creando cuenta…" : "Entrando…"
              : mode === "signup" ? "Crear cuenta CALA" : "Iniciar sesión"}
          </button>

          {/* ── Separador ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "0.5rem 0" }}>
            <hr style={{ flex: 1, border: "none", borderTop: "1px solid #e0d6cc" }} />
            <span style={{ fontSize: "0.75rem", color: "#b0a89f", whiteSpace: "nowrap" }}>
              {mode === "signin" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
            </span>
            <hr style={{ flex: 1, border: "none", borderTop: "1px solid #e0d6cc" }} />
          </div>

          {/* ── Botón alternativo de modo ── */}
          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setSuccess(""); }}
            style={{
              width: "100%",
              padding: "0.6rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: "transparent",
              color: "#23211F",
              border: "1px solid #c8bdb5",
              borderRadius: "0.5rem",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            {mode === "signin" ? "Crear cuenta CALA" : "Iniciar sesión"}
          </button>

          <p className="helper" style={{ marginTop: "0.75rem" }}>
            {mode === "signin"
              ? "Si necesitas recuperar el acceso, contacta al administrador."
              : "Al registrarte, tendrás acceso al panel de administración."}
          </p>
          <Link href="/es/">Volver a la web</Link>
        </form>
      </section>
    </main>
  );
}
