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

const steps = ["Conectar", "Reenvío", "Prueba real", "Responder"] as const;
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
 * proven with real data: Resend configured by CALA itself, the forwarding
 * confirmation and a real OTA e-mail arriving at the CALA address.
 */
export function MessageAssistant({ onClose }: { onClose: () => void }) {
  const { data, can } = useWorkspace();
  const propertyId = data.currentPropertyId;
  const [step, setStep] = useState(0);
  const [otas, setOtas] = useState<ConnectorProvider[]>(["airbnb", "booking"]);
  const [receiving, setReceiving] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [testSince, setTestSince] = useState<string | null>(null);
  const [forwardSince] = useState(() => new Date(Date.now() - 30 * 60000).toISOString());
  const { state, refresh } = useConnectorState(propertyId, step === 1 || step === 2 ? 4000 : 0);
  const mail = state?.mail;
  const ready = Boolean(mail?.apiKey && mail.receiving && mail.webhook);
  const address = state?.inbox?.address ?? null;
  const app = mailAppFor(email);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const domains = otas.map((o) => otaGuides[o].mailDomain).filter(Boolean);
  const filter = `from:(${domains.join(" OR ")})`;
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
  const receivingFormat = /^([^\s@]+@)?[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(receiving.trim());

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  const connect = () =>
    run(async () => {
      if (!ready) await connector("mail.configure", { propertyId, domain: receiving.trim() });
      if (!state?.inbox) await connector("inbox.enable", { propertyId });
    });
  async function copy(key: string, text: string) {
    if (await copyText(text)) {
      setCopied(key);
      window.setTimeout(() => setCopied(""), 2500);
    }
  }
  function go(next: number) {
    setError("");
    if (next === 2 && !testSince) setTestSince(new Date(Date.now() - 5000).toISOString());
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
  const addressBox = address && (
    <div className="cx-copy">
      <input readOnly value={address} aria-label="Dirección de CALA" onFocus={(e) => e.currentTarget.select()} />
      {copyButton("address", address)}
    </div>
  );

  if (!can("channel.manage"))
    return (
      <Modal title="Asistente de mensajes" onClose={onClose}>
        <p>Conectar mensajes requiere el permiso «Gestionar canales». Pide a un administrador que lo haga.</p>
      </Modal>
    );

  const canNext = [ready && Boolean(address), emailOk, Boolean(testOk), true][step];

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
                Airbnb, Booking.com, Vrbo y Expedia te avisan por correo cuando un huésped escribe. Reenvías esos avisos a una dirección de CALA y cada mensaje aparece en la bandeja, unido a su reserva. Solo conecta mensajes.
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
              {!state ? (
                <p className="ota-inline" role="status">
                  <Icon name="spinner" size={16} /> Comprobando…
                </p>
              ) : !mail?.apiKey ? (
                <div className="notice warning">
                  <p>Falta la clave de Resend en el servidor (RESEND_API_KEY). Agrégala en Vercel → Settings → Environment Variables y vuelve a desplegar.</p>
                  <button type="button" className="button secondary" onClick={() => void refresh()}>
                    <Icon name="sync" size={16} /> Volver a comprobar
                  </button>
                </div>
              ) : ready && address ? (
                <>
                  <ul className="ota-verify">
                    {check(true, `Resend conectado (@${mail.domain})`)}
                    {check(true, "Tu dirección privada de CALA está lista")}
                  </ul>
                  {addressBox}
                </>
              ) : (
                <>
                  {!ready && (<>
                  <h4>Conecta Resend (una sola vez)</h4>
                  <ol className="cx-steps">
                    <li>
                      Abre <a href="https://resend.com/emails/receiving" target="_blank" rel="noreferrer">Resend → Emails → Receiving</a>.
                    </li>
                    <li>Pulsa los tres puntos (⋯) → «Receiving address» y copia la dirección (termina en .resend.app).</li>
                    <li>Pégala aquí y pulsa «Conectar». CALA crea el webhook en Resend por ti.</li>
                  </ol>
                  <label className="field">
                    <span>Dirección de recepción de Resend</span>
                    <input
                      inputMode="email"
                      spellCheck={false}
                      value={receiving}
                      placeholder="algo@abcd1234.resend.app"
                      aria-invalid={Boolean(receiving) && !receivingFormat}
                      onChange={(e) => setReceiving(e.target.value)}
                    />
                  </label>
                  {mail?.suggestions?.length ? (
                    <p className="muted">
                      También puedes usar tu dominio con recepción activa:{" "}
                      {mail.suggestions.map((d) => (
                        <button key={d} type="button" className="button secondary" onClick={() => setReceiving(d)}>
                          {d}
                        </button>
                      ))}
                    </p>
                  ) : null}
                  {receiving && !receivingFormat && (
                    <p className="ota-inline bad">
                      <Icon name="warning" size={16} /> Pega la dirección completa, por ejemplo algo@abcd1234.resend.app.
                    </p>
                  )}
                  </>)}
                  <button type="button" className="button primary" disabled={busy || (!mail?.receiving && !receivingFormat)} onClick={() => void connect()}>
                    {busy ? <Icon name="spinner" size={16} /> : <Icon name="webhook" size={16} />}
                    {busy ? "Conectando…" : "Conectar"}
                  </button>
                </>
              )}
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
          {step === 1 && address && (
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
                  {addressBox}
                  <ul className="ota-verify" aria-live="polite">
                    {check(
                      Boolean(forwardingInfo),
                      forwardingInfo
                        ? forwardingInfo.code
                          ? `Gmail envió la confirmación ${timeAgo(forwarding!.receivedAt)}. Código: ${forwardingInfo.code}`
                          : `Gmail envió la confirmación ${timeAgo(forwarding!.receivedAt)}`
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
                    <li>Nombre: «CALA». Condición: «De» → escribe {domains.join(", ")}.</li>
                    <li>Acción: «Reenviar a» → pega tu dirección de CALA. Guarda.</li>
                  </ol>
                  {addressBox}
                  <p className="muted">Si Outlook avisa que el reenvío externo está bloqueado, actívalo en Configuración → Correo → Reenvío.</p>
                </>
              )}
              {emailOk && app === "other" && (
                <>
                  <ol className="cx-steps">
                    <li>En la configuración de tu correo busca «Reglas», «Filtros» o «Reenvío».</li>
                    <li>Crea una regla: si el remitente contiene {listOf(domains, "disjunction")}, reenviar a tu dirección de CALA.</li>
                    <li>Si tu correo pide confirmar la dirección, el aviso llegará a CALA y lo verás en el siguiente paso.</li>
                  </ol>
                  {addressBox}
                </>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h3>Prueba con un correo real</h3>
              <p className="muted">
                Reenvía a tu dirección de CALA un aviso de mensaje que ya tengas de {listOf(otas.map((o) => otaGuides[o].label), "disjunction")} (por ejemplo «Nuevo mensaje de…»). Con el filtro activo, los siguientes llegarán solos.
              </p>
              {addressBox}
              <ul className="ota-verify" aria-live="polite">
                {check(testEmails.length > 0, testEmails.length ? (testEmails.length === 1 ? `Llegaron ${testEmails.length} correo a CALA` : `Llegaron ${testEmails.length} correos a CALA`) : "Esperando un correo…", !testEmails.length)}
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
                        {e.kind === "message" ? "en la bandeja" : e.kind === "forwarding" ? "confirmación de reenvío" : "no es de una OTA"}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {step === 3 && (
            <div className="ota-done">
              <span className="ota-done-mark" aria-hidden="true">
                <Icon name="check" size={34} />
              </span>
              <h3>Los mensajes de tus OTAs ya llegan a CALA</h3>
              <ol className="ota-next">
                <li>Cada mensaje aparece en Mensajes, unido a su reserva cuando CALA la reconoce.</li>
                <li>Para responder, escribe en CALA (con plantillas si quieres) y pulsa «Copiar y abrir en Airbnb» (o la OTA que sea): se abre esa conversación con tu texto copiado; solo pegas y envías.</li>
                <li>Así la respuesta sale por el chat oficial de la OTA, que es lo que Airbnb y Booking.com exigen, y queda registrada en CALA.</li>
              </ol>
              <button type="button" className="button primary" onClick={onClose}>
                Ir a la bandeja
              </button>
            </div>
          )}
        </section>
        {step < 3 && (
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
              {step === 2 ? (testOk ? "Verificado, continuar" : "Esperando el correo…") : "Continuar"}
              <Icon name="chevron-right" size={16} />
            </button>
          </footer>
        )}
      </div>
    </Modal>
  );
}
