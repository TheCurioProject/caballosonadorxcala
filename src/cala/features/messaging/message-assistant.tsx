"use client";
import { useState } from "react";
import { Icon, Modal } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import { dateTime } from "@/cala/lib/format";
import {
  connector,
  otaGuides,
  listOf,
  timeAgo,
  useConnectorState,
  type ConnectorProvider,
} from "@/cala/features/integrations/connectors";
import { copyText, OtaMark } from "@/cala/features/integrations/calendar-assistant";

const steps = ["Servidor", "Tu dirección", "Reenvío", "Prueba real", "Respuestas"] as const;
const mailOtas: ConnectorProvider[] = ["airbnb", "booking", "vrbo", "expedia"];
type MailApp = "gmail" | "outlook" | "other";

function mailAppFor(email: string): MailApp | null {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (!domain) return null;
  if (/^(gmail|googlemail)\.com$/.test(domain)) return "gmail";
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) return "outlook";
  return "other";
}

/**
 * Connects only OTA guest messages, through e-mail forwarding. Every step is
 * proven with real data: server checks, the forwarding confirmation and a real
 * OTA e-mail arriving at the CALA address.
 */
export function MessageAssistant({ onClose }: { onClose: () => void }) {
  const { data, can } = useWorkspace();
  const propertyId = data.currentPropertyId;
  const [step, setStep] = useState(0);
  const [otas, setOtas] = useState<ConnectorProvider[]>(["airbnb", "booking"]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [testSince, setTestSince] = useState<string | null>(null);
  const [forwardSince] = useState(() => new Date(Date.now() - 30 * 60000).toISOString());
  const { state, refresh } = useConnectorState(propertyId, step === 2 || step === 3 ? 4000 : 0);
  const mail = state?.mail;
  const serverReady = Boolean(mail?.receiving && mail.webhook && mail.sending);
  const address = state?.inbox?.address ?? null;
  const app = mailAppFor(email);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const filter = `from:(${otas.map((o) => otaGuides[o].mailDomain).filter(Boolean).join(" OR ")})`;
  const forwarding = state?.emails.find((e) => e.kind === "forwarding" && e.receivedAt >= forwardSince);
  const forwardingInfo = (() => {
    try {
      return forwarding?.summary ? (JSON.parse(forwarding.summary) as { code: string; link: string }) : null;
    } catch {
      return null;
    }
  })();
  const testEmails = testSince ? (state?.emails ?? []).filter((e) => e.receivedAt >= testSince) : [];
  const testOk = testEmails.find((e) => e.kind === "message");

  async function enable() {
    setBusy(true);
    setError("");
    try {
      await connector("inbox.enable", { propertyId });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la dirección.");
    } finally {
      setBusy(false);
    }
  }
  async function copy(key: string, text: string) {
    if (await copyText(text)) {
      setCopied(key);
      window.setTimeout(() => setCopied(""), 2500);
    }
  }
  function go(next: number) {
    setError("");
    if (next === 1 && !state?.inbox) void enable();
    if (next === 3 && !testSince) setTestSince(new Date(Date.now() - 5000).toISOString());
    setStep(next);
  }
  const copyButton = (key: string, text: string, label = "Copiar") => (
    <button type="button" className="button secondary" onClick={() => void copy(key, text)}>
      <Icon name={copied === key ? "check" : "copy"} size={16} />
      {copied === key ? "Copiado" : label}
    </button>
  );
  const check = (ok: boolean, text: string, running = false) => (
    <li className={ok ? "is-ok" : running ? "is-running" : "is-bad"}>
      <span>{ok ? <Icon name="check" size={13} /> : running ? <i /> : <Icon name="warning" size={13} />}</span>
      {text}
    </li>
  );

  if (!can("channel.manage"))
    return (
      <Modal title="Asistente de mensajes" onClose={onClose}>
        <p>Conectar mensajes requiere el permiso «Gestionar canales». Pide a un administrador que lo haga.</p>
      </Modal>
    );

  const canNext = [
    serverReady,
    Boolean(address),
    emailOk,
    Boolean(testOk),
    true,
  ][step];

  return (
    <Modal title="Asistente de mensajes de OTAs" onClose={onClose} wide>
      <div className="ota">
        <ol className="ota-steps" aria-label="Progreso">
          {steps.map((label, i) => (
            <li key={label} className={`${i === step ? "is-current" : ""}${i < step ? " is-done" : ""}`} aria-current={i === step ? "step" : undefined}>
              <span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
        <div className="ota-progress" style={{ width: `${(step / (steps.length - 1)) * 100}%` }} aria-hidden="true" />
        <section className="ota-body ota-fwd" key={step}>
          {step === 0 && (
            <>
              <h3>Mensajes de tus OTAs en CALA</h3>
              <p className="muted">
                Airbnb, Booking.com, Vrbo y Expedia te avisan por correo cuando un huésped escribe. Reenviaremos esos avisos a una dirección privada de CALA: el mensaje aparece en la bandeja y tu respuesta vuelve al chat de la OTA. Solo conecta mensajes; no toca calendarios ni precios.
              </p>
              <fieldset className="ota-fieldset">
                <legend>¿De qué OTAs recibes mensajes?</legend>
                <div className="ota-grid">
                  {mailOtas.map((p) => (
                    <button
                      type="button"
                      key={p}
                      className={`ota-card${otas.includes(p) ? " is-selected" : ""}`}
                      aria-pressed={otas.includes(p)}
                      onClick={() => setOtas((o) => (o.includes(p) ? (o.length > 1 ? o.filter((x) => x !== p) : o) : [...o, p]))}
                    >
                      <OtaMark provider={p} />
                      <strong>{otaGuides[p].label}</strong>
                    </button>
                  ))}
                </div>
              </fieldset>
              <h4>Comprobación del servidor</h4>
              {!state ? (
                <p className="ota-inline" role="status">
                  <Icon name="spinner" size={16} /> Comprobando…
                </p>
              ) : (
                <ul className="ota-verify">
                  {check(Boolean(mail?.receiving), mail?.receiving ? `Recepción de correo activa (@${mail.domain})` : "Falta el dominio de recepción (CALA_INBOUND_DOMAIN)")}
                  {check(Boolean(mail?.webhook), mail?.webhook ? "Aviso de correo entrante protegido" : "Falta la clave del webhook (RESEND_WEBHOOK_SECRET)")}
                  {check(Boolean(mail?.sending), mail?.sending ? "Envío de respuestas activo" : "Falta la clave de envío (RESEND_API_KEY)")}
                </ul>
              )}
              {state && !serverReady && (
                <div className="notice warning">
                  <p>
                    <strong>Esto lo configura una sola vez quien administra el sitio:</strong>
                  </p>
                  <ol className="cx-steps">
                    <li>En Resend → Domains, añade un dominio de recepción (por ejemplo inbox.casacaballosonador.com) y crea su registro MX; o usa el dominio .resend.app que Resend te da.</li>
                    <li>
                      En Resend → Webhooks, crea uno con la URL <code>{state.webhookUrl}</code> y los eventos «email.received» y «email.bounced».
                    </li>
                    <li>En Vercel → Settings → Environment Variables añade CALA_INBOUND_DOMAIN, RESEND_WEBHOOK_SECRET (la clave del webhook) y RESEND_API_KEY, y vuelve a desplegar.</li>
                  </ol>
                  <button type="button" className="button secondary" onClick={() => void refresh()}>
                    <Icon name="sync" size={16} /> Volver a comprobar
                  </button>
                </div>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <h3>Tu dirección privada de CALA</h3>
              <p className="muted">Todo lo que llegue aquí se guarda en la bandeja de esta propiedad. No la publiques: úsala solo para reenviar los avisos de las OTAs.</p>
              {address ? (
                <div className="cx-copy">
                  <input readOnly value={address} aria-label="Dirección de CALA" onFocus={(e) => e.currentTarget.select()} />
                  {copyButton("address", address)}
                </div>
              ) : (
                <p className="ota-inline" role="status">
                  <Icon name="spinner" size={16} /> Creando tu dirección…
                </p>
              )}
              {error && <p className="notice error">{error}</p>}
            </>
          )}
          {step === 2 && address && (
            <>
              <h3>Reenvía los avisos a CALA</h3>
              <label className="field">
                <span>¿Con qué correo entras a {listOf(otas.map((o) => otaGuides[o].label))}?</span>
                <input inputMode="email" autoComplete="email" value={email} placeholder="tu@correo.com" aria-invalid={Boolean(email) && !emailOk} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {email && !emailOk && (
                <p className="ota-inline bad">
                  <Icon name="warning" size={16} /> Escribe el correo completo.
                </p>
              )}
              {emailOk && app === "gmail" && (
                <>
                  <ol className="cx-steps">
                    <li>
                      Abre <a href="https://mail.google.com/mail/u/0/#settings/fwdandpop" target="_blank" rel="noreferrer">Gmail → Configuración → Reenvío y correo POP/IMAP</a>.
                    </li>
                    <li>Pulsa «Añadir una dirección de reenvío», pega tu dirección de CALA y pulsa «Siguiente» → «Continuar».</li>
                    <li>Gmail enviará un código a CALA. Aparecerá aquí abajo en unos segundos.</li>
                  </ol>
                  <div className="cx-copy">
                    <input readOnly value={address} aria-label="Dirección de CALA" />
                    {copyButton("address", address)}
                  </div>
                  <ul className="ota-verify" aria-live="polite">
                    {check(
                      Boolean(forwardingInfo),
                      forwardingInfo
                        ? `Gmail envió la confirmación ${timeAgo(forwarding!.receivedAt)}${forwardingInfo.code ? `. Código: ${forwardingInfo.code}` : ""}`
                        : "Esperando el código de confirmación de Gmail…",
                      !forwardingInfo,
                    )}
                  </ul>
                  {forwardingInfo && (
                    <div className="notice success">
                      {forwardingInfo.code && (
                        <p className="cx-code">
                          <strong>{forwardingInfo.code}</strong> {copyButton("code", forwardingInfo.code, "Copiar código")}
                        </p>
                      )}
                      {forwardingInfo.link ? (
                        <a className="button primary" href={forwardingInfo.link} target="_blank" rel="noreferrer">
                          <Icon name="external-link" size={16} /> Confirmar el reenvío en Gmail
                        </a>
                      ) : (
                        <p>Escribe el código en Gmail, en la misma pantalla de Reenvío, y pulsa «Verificar».</p>
                      )}
                    </div>
                  )}
                  <ol className="cx-steps" start={4}>
                    <li>
                      Ahora crea un filtro para reenviar solo los avisos de las OTAs: en la búsqueda de Gmail pega esto y pulsa «Crear filtro».
                      <div className="cx-copy">
                        <input readOnly value={filter} aria-label="Filtro de Gmail" />
                        {copyButton("filter", filter)}
                      </div>
                    </li>
                    <li>Marca «Reenviarlo a» y elige tu dirección de CALA. Pulsa «Crear filtro».</li>
                  </ol>
                  <p className="muted">No elijas «Reenviar una copia de todo el correo»: el filtro evita que CALA reciba tu correo personal.</p>
                </>
              )}
              {emailOk && app === "outlook" && (
                <>
                  <ol className="cx-steps">
                    <li>
                      Abre <a href="https://outlook.live.com/mail/0/options/mail/rules" target="_blank" rel="noreferrer">Outlook → Configuración → Correo → Reglas</a> y pulsa «Agregar nueva regla».
                    </li>
                    <li>Nombre: «CALA». Condición: «De» → escribe {otas.map((o) => otaGuides[o].mailDomain).join(", ")}.</li>
                    <li>Acción: «Reenviar a» → pega tu dirección de CALA. Guarda.</li>
                  </ol>
                  <div className="cx-copy">
                    <input readOnly value={address} aria-label="Dirección de CALA" />
                    {copyButton("address", address)}
                  </div>
                  <p className="muted">Si Outlook avisa que el reenvío externo está bloqueado, actívalo en Configuración → Correo → Reenvío.</p>
                </>
              )}
              {emailOk && app === "other" && (
                <>
                  <ol className="cx-steps">
                    <li>En la configuración de tu correo busca «Reglas», «Filtros» o «Reenvío».</li>
                    <li>Crea una regla: si el remitente contiene {listOf(otas.map((o) => otaGuides[o].mailDomain), "disjunction")}, reenviar a tu dirección de CALA.</li>
                    <li>Si tu correo pide confirmar la dirección, el aviso llegará a CALA y lo verás en el siguiente paso.</li>
                  </ol>
                  <div className="cx-copy">
                    <input readOnly value={address} aria-label="Dirección de CALA" />
                    {copyButton("address", address)}
                  </div>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <h3>Prueba con un correo real</h3>
              <p className="muted">
                Reenvía a tu dirección de CALA un aviso de mensaje que ya tengas de {listOf(otas.map((o) => otaGuides[o].label), "disjunction")} (por ejemplo «Nuevo mensaje de…»). Con el filtro activo, los siguientes llegarán solos.
              </p>
              {address && (
                <div className="cx-copy">
                  <input readOnly value={address} aria-label="Dirección de CALA" />
                  {copyButton("address", address)}
                </div>
              )}
              <ul className="ota-verify" aria-live="polite">
                {check(testEmails.length > 0, testEmails.length ? `Llegaron ${testEmails.length} ${testEmails.length === 1 ? "correo" : "correos"} a CALA` : "Esperando un correo…", !testEmails.length)}
                {testEmails.length > 0 &&
                  check(
                    Boolean(testOk),
                    testOk
                      ? `Reconocido como mensaje de ${otaGuides[testOk.provider ?? "other"].label}: «${testOk.summary ?? testOk.subject ?? ""}»`
                      : "El correo no parece un aviso de mensaje de una OTA. Reenvía uno que diga «mensaje» de Airbnb o Booking.com.",
                  )}
              </ul>
              {testEmails.length > 0 && (
                <ul className="cx-mail-log">
                  {testEmails.map((e) => (
                    <li key={e.id}>
                      <strong>{e.subject || "(sin asunto)"}</strong>
                      <small>
                        {e.from} · {dateTime(e.receivedAt)} ·{" "}
                        {e.kind === "message" ? (e.threadId ? "en la bandeja" : "mensaje") : e.kind === "forwarding" ? "confirmación de reenvío" : e.kind === "bounce" ? "rebote" : "no es de una OTA"}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {step === 4 && (
            <div className="ota-done">
              <span className="ota-done-mark" aria-hidden="true">
                <Icon name="check" size={34} />
              </span>
              <h3>Los mensajes de tus OTAs ya llegan a CALA</h3>
              <ul className="ota-verify cx-final">
                {check(true, "Correos de OTAs recibidos y vinculados a la bandeja")}
                {check(
                  Boolean(state?.outbound.sent),
                  state?.outbound.sent
                    ? `Respuestas enviadas: ${state.outbound.sent}${state.outbound.failed ? ` · ${state.outbound.failed} rechazadas` : ""}`
                    : "Respuestas: aún no envías ninguna. Responde una conversación para probarlo.",
                )}
              </ul>
              <ol className="ota-next">
                <li>Al responder desde CALA, el correo sale hacia la dirección de respuesta de la OTA y aparece en su chat con el huésped.</li>
                <li>Si la OTA rechaza una respuesta, el mensaje se marca «No entregado» con el motivo, para que respondas desde la OTA.</li>
                <li>Las conversaciones solo pueden responderse cuando el huésped escribió primero (la OTA da la dirección de respuesta en su aviso).</li>
              </ol>
              <button type="button" className="button primary" onClick={onClose}>
                Ir a la bandeja
              </button>
            </div>
          )}
        </section>
        {step < 4 && (
          <footer className="ota-foot">
            {step > 0 ? (
              <button type="button" className="button secondary" disabled={busy} onClick={() => go(step - 1)}>
                <Icon name="chevron-left" size={16} />
                Atrás
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="button primary" disabled={!canNext || busy} onClick={() => go(step + 1)}>
              {step === 3 ? (testOk ? "Verificado, continuar" : "Esperando el correo…") : "Continuar"}
              <Icon name="chevron-right" size={16} />
            </button>
          </footer>
        )}
      </div>
    </Modal>
  );
}
