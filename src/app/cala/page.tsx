"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/** Handles Supabase auth redirect tokens (password recovery, magic link, etc.) */
export default function CalaAuthRedirect() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "reset" | "done">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      setMode("reset");
    } else {
      router.replace("/admin/");
    }
  }, [router]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 8) { setError("Mínimo 8 caracteres."); return; }
    setBusy(true);
    setError("");
    try {
      // Parse token from hash fragment
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token")!;
      const refreshToken = params.get("refresh_token") ?? "";

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      // Set the session from the recovery token
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) { setError(updateErr.message); return; }
      setMode("done");
      setTimeout(() => router.replace("/admin/"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui" }}>
        <p style={{ color: "#6b6560" }}>Verificando sesión…</p>
      </div>
    );
  }

  if (mode === "done") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui", flexDirection: "column", gap: "1rem" }}>
        <p style={{ color: "#2d6a4f", fontWeight: 600 }}>✅ Contraseña actualizada correctamente</p>
        <p style={{ color: "#6b6560" }}>Redirigiendo al panel…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui", background: "#f5f0eb" }}>
      <form
        onSubmit={handleReset}
        style={{ background: "#fff", padding: "2rem", borderRadius: "1rem", boxShadow: "0 2px 20px rgba(0,0,0,.08)", width: "100%", maxWidth: "380px", display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#23211F" }}>Nueva contraseña</h1>
        <p style={{ margin: 0, color: "#6b6560", fontSize: "0.875rem" }}>Elige una contraseña segura para tu cuenta CALA.</p>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.875rem", color: "#23211F" }}>
          Nueva contraseña
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required minLength={8} placeholder="Mínimo 8 caracteres"
            style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #d6ccc4", fontSize: "1rem" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.875rem", color: "#23211F" }}>
          Confirmar contraseña
          <input
            type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            required minLength={8} placeholder="Repite tu contraseña"
            style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #d6ccc4", fontSize: "1rem" }}
          />
        </label>

        {error && <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.875rem" }}>{error}</p>}

        <button
          type="submit" disabled={busy}
          style={{ padding: "0.75rem", background: "#23211F", color: "#fff", border: "none", borderRadius: "0.5rem", fontSize: "1rem", fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
        >
          {busy ? "Guardando…" : "Guardar contraseña"}
        </button>

        {/* Full document load on purpose: the panel must re-read the new session. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/admin/" style={{ textAlign: "center", color: "#9B7E67", fontSize: "0.875rem", textDecoration: "none" }}>
          Volver al panel
        </a>
      </form>
    </div>
  );
}

