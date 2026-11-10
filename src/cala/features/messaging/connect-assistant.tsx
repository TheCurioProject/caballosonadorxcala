"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon, Modal } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  connectionFor,
  otaCatalog,
  otaList,
  type OtaProvider,
} from "@/cala/domain/messaging/ota";

type Draft = {
  provider: OtaProvider | null;
  checks: boolean[];
  account: string;
  links: Record<string, { on: boolean; externalId: string; ratePlanId: string }>;
  syncMode: "ari" | "all";
  ownership: "pms" | "channel";
};
const steps = [
  "Canal",
  "Prepara tu cuenta",
  "Identifica la cuenta",
  "Vincula alojamientos",
  "Preferencias",
  "Verificar y activar",
] as const;

/**
 * Step-by-step OTA connection assistant. Each step validates before moving on;
 * the last one runs the checks and registers the connection (channel.connect).
 */
export function ConnectAssistant({
  initialProvider = null,
  onClose,
}: {
  initialProvider?: OtaProvider | null;
  onClose: () => void;
}) {
  const { data, can, command } = useWorkspace();
  const propertyId = data.currentPropertyId;
  const types = data.inventoryTypes.filter(
    (t) => t.propertyId === propertyId && t.active,
  );
  const plans = data.ratePlans.filter(
    (p) => p.propertyId === propertyId && p.active,
  );
  const storageKey = `cala.ota.draft.${propertyId}`;
  const blank = (provider: OtaProvider | null): Draft => {
    const existing = connectionFor(data.channels, propertyId, provider);
    return {
      provider,
      checks: [false, false, false],
      account: existing?.name.split(" · ").slice(1).join(" · ") ?? "",
      links: Object.fromEntries(
        types.map((t) => {
          const m = existing?.mappings.find((x) => x.inventoryTypeId === t.id);
          return [
            t.id,
            {
              on: Boolean(m) || types.length === 1,
              externalId: m?.externalId ?? "",
              ratePlanId: m?.ratePlanId ?? plans[0]?.id ?? "",
            },
          ];
        }),
      ),
      syncMode: existing?.syncMode ?? "all",
      ownership: existing?.ownership ?? "pms",
    };
  };
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (
        saved &&
        typeof saved === "object" &&
        (!initialProvider || saved.provider === initialProvider)
      )
        return { ...blank(saved.provider ?? null), ...saved };
    } catch {
      /* no draft */
    }
    return blank(initialProvider);
  });
  const [step, setStep] = useState(draft.provider ? 1 : 0);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");
  const [touched, setTouched] = useState(false);
  const [verifying, setVerifying] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      if (done) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* storage unavailable */
    }
  }, [draft, done, storageKey]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const ota = draft.provider ? otaCatalog[draft.provider] : null;
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const linked = types.filter((t) => draft.links[t.id]?.on);
  const accountOk = Boolean(ota && ota.account.pattern.test(draft.account.trim()));
  const listingErrors = linked
    .map((t) => {
      const l = draft.links[t.id];
      if (!ota) return null;
      if (!ota.listing.pattern.test(l.externalId.trim()))
        return `${t.name}: escribe un ${ota.listing.label.toLowerCase()} válido.`;
      if (!l.ratePlanId) return `${t.name}: elige una tarifa.`;
      return null;
    })
    .filter(Boolean) as string[];
  const ids = linked.map((t) => draft.links[t.id].externalId.trim());
  const duplicate = new Set(ids).size !== ids.length;

  const valid = [
    Boolean(ota),
    draft.checks.every(Boolean),
    accountOk,
    linked.length > 0 && !listingErrors.length && !duplicate,
    true,
    true,
  ];
  const checksList = ota
    ? [
        `Cuenta de ${ota.label} identificada`,
        `${linked.length} ${linked.length === 1 ? "alojamiento vinculado" : "alojamientos vinculados"} sin duplicados`,
        "Tarifas asignadas a cada alojamiento",
        "Bandeja de mensajes centralizada lista",
        "Permisos de canal comprobados",
      ]
    : [];

  function go(next: number) {
    if (next > step && !valid[step]) {
      setTouched(true);
      return;
    }
    setTouched(false);
    setDirection(next > step ? "fwd" : "back");
    setStep(next);
    if (next === 5) runChecks();
  }
  function runChecks() {
    timers.current.forEach(clearTimeout);
    setVerifying(0);
    checksList.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => setVerifying(i + 1), 380 * (i + 1)),
      );
    });
  }
  async function activate() {
    if (!ota) return;
    setBusy(true);
    setError("");
    try {
      await command({
        type: "channel.connect",
        provider: ota.id,
        name: `${ota.label} · ${draft.account.trim()}`,
        syncMode: draft.syncMode,
        ownership: draft.ownership,
        mappings: linked.map((t) => ({
          inventoryTypeId: t.id,
          ratePlanId: draft.links[t.id].ratePlanId,
          externalId: draft.links[t.id].externalId.trim(),
        })),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar.");
    } finally {
      setBusy(false);
    }
  }

  if (!can("channel.manage"))
    return (
      <Modal title="Asistente de conexión" onClose={onClose}>
        <p>
          Conectar un canal requiere el permiso «Gestionar canales». Pide a un
          administrador de la cuenta que complete el asistente.
        </p>
      </Modal>
    );

  return (
    <Modal title="Asistente de conexión de canales" onClose={onClose} wide>
      <div className="ota">
        {done && ota ? (
          <div className="ota-done">
            <span className="ota-done-mark" aria-hidden="true">
              <Icon name="check" size={34} />
            </span>
            <h3>{ota.label} quedó conectado en CALA</h3>
            <p>
              Registramos la cuenta y {linked.length}{" "}
              {linked.length === 1 ? "alojamiento" : "alojamientos"}. Las
              conversaciones de huéspedes de {ota.label} se agrupan en esta
              bandeja.
            </p>
            <ol className="ota-next">
              <li>
                <strong>Autoriza a CALA en {ota.label}.</strong> Cuando el
                conector del proveedor esté disponible, acepta la solicitud en{" "}
                <a href={ota.portal.url} target="_blank" rel="noreferrer">
                  {ota.portal.label}
                </a>
                .
              </li>
              <li>
                <strong>Mientras tanto</strong>, las respuestas que envíes
                quedan en cola con estado «Pendiente de entrega»; nada se envía
                sin la autorización.
              </li>
              <li>
                <strong>Primera sincronización:</strong> verás la fecha en
                Canales cuando el proveedor confirme el acceso.
              </li>
            </ol>
            <button className="button primary" onClick={onClose}>
              Ir a la bandeja
            </button>
          </div>
        ) : (
          <>
            <ol className="ota-steps" aria-label="Progreso">
              {steps.map((label, i) => (
                <li
                  key={label}
                  className={`${i === step ? "is-current" : ""}${i < step ? " is-done" : ""}`}
                  aria-current={i === step ? "step" : undefined}
                >
                  <span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
                  <small>{label}</small>
                </li>
              ))}
            </ol>
            <div
              className="ota-progress"
              style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
              aria-hidden="true"
            />
            <section className={`ota-body ota-${direction}`} key={step}>
              {step === 0 && (
                <>
                  <h3>¿Qué canal quieres conectar?</h3>
                  <p className="muted">
                    Centraliza reservas y mensajes de tus OTAs en CALA. Puedes
                    conectar varios, uno a la vez.
                  </p>
                  <div className="ota-grid">
                    {otaList.map((o) => {
                      const existing = connectionFor(
                        data.channels,
                        propertyId,
                        o.id,
                      );
                      return (
                        <button
                          type="button"
                          key={o.id}
                          className={`ota-card${draft.provider === o.id ? " is-selected" : ""}`}
                          aria-pressed={draft.provider === o.id}
                          onClick={() => {
                            setDraft(blank(o.id));
                            setDirection("fwd");
                            setStep(1);
                          }}
                        >
                          <span
                            className="ota-mark"
                            style={{ "--ota-hue": o.hue } as CSSProperties}
                          >
                            {o.mark}
                          </span>
                          <strong>{o.label}</strong>
                          <small>
                            {existing ? "Conectado · reconfigurar" : "Sin conectar"}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {step === 1 && ota && (
                <>
                  <h3>Prepara tu cuenta de {ota.label}</h3>
                  <p className="muted">
                    Marca cada paso cuando lo tengas listo. Puedes cerrar el
                    asistente: guardamos tu avance en este dispositivo.
                  </p>
                  <div className="ota-checklist">
                    {ota.prepare.map((text, i) => (
                      <label
                        key={i}
                        className={`ota-check${draft.checks[i] ? " is-checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={draft.checks[i] ?? false}
                          onChange={(e) => {
                            const checks = [...draft.checks];
                            checks[i] = e.target.checked;
                            patch({ checks });
                          }}
                        />
                        <span className="ota-check-box" aria-hidden="true">
                          <Icon name="check" size={12} />
                        </span>
                        <span>{text}</span>
                      </label>
                    ))}
                  </div>
                  <a
                    className="button secondary"
                    href={ota.portal.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="external-link" size={16} />
                    {ota.portal.label}
                  </a>
                  {touched && !valid[1] && (
                    <p className="notice warning" role="alert">
                      Completa los tres pasos para continuar.
                    </p>
                  )}
                </>
              )}
              {step === 2 && ota && (
                <>
                  <h3>Identifica tu cuenta</h3>
                  <label className="field">
                    <span>{ota.account.label}</span>
                    <input
                      autoFocus
                      value={draft.account}
                      placeholder={ota.account.example}
                      aria-invalid={touched && !accountOk}
                      onChange={(e) => patch({ account: e.target.value })}
                    />
                    <small>{ota.account.hint}</small>
                  </label>
                  {draft.account && (
                    <p className={`ota-inline ${accountOk ? "ok" : "bad"}`}>
                      <Icon name={accountOk ? "success-circle" : "warning"} size={16} />
                      {accountOk
                        ? "Formato correcto."
                        : `Revisa el formato. Ejemplo: ${ota.account.example}`}
                    </p>
                  )}
                </>
              )}
              {step === 3 && ota && (
                <>
                  <h3>Vincula tus alojamientos</h3>
                  <p className="muted">
                    Relaciona cada tipo de alojamiento de CALA con su{" "}
                    {ota.listing.label.toLowerCase()} en {ota.label}.{" "}
                    {ota.listing.hint}
                  </p>
                  {!types.length && (
                    <p className="notice warning">
                      Primero crea un tipo de alojamiento en Inventario.
                    </p>
                  )}
                  {!plans.length && (
                    <p className="notice warning">
                      Crea un plan de tarifas en Tarifas para poder vincular.
                    </p>
                  )}
                  <div className="ota-links">
                    {types.map((t) => {
                      const l = draft.links[t.id] ?? {
                        on: false,
                        externalId: "",
                        ratePlanId: plans[0]?.id ?? "",
                      };
                      const set = (p: Partial<typeof l>) =>
                        patch({
                          links: { ...draft.links, [t.id]: { ...l, ...p } },
                        });
                      const ok = ota.listing.pattern.test(l.externalId.trim());
                      return (
                        <div
                          key={t.id}
                          className={`ota-link${l.on ? " is-on" : ""}`}
                        >
                          <label className="ota-link-toggle">
                            <input
                              type="checkbox"
                              checked={l.on}
                              onChange={(e) => set({ on: e.target.checked })}
                            />
                            <span>
                              <strong>{t.name}</strong>
                              <small>
                                {
                                  data.units.filter(
                                    (u) => u.inventoryTypeId === t.id && u.active,
                                  ).length
                                }{" "}
                                unidades · hasta {t.maxOccupancy} huéspedes
                              </small>
                            </span>
                          </label>
                          {l.on && (
                            <div className="ota-link-fields">
                              <label className="field">
                                <span>{ota.listing.label}</span>
                                <input
                                  inputMode="text"
                                  value={l.externalId}
                                  placeholder={ota.listing.example}
                                  aria-invalid={Boolean(l.externalId) && !ok}
                                  onChange={(e) =>
                                    set({ externalId: e.target.value })
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>Tarifa</span>
                                <select
                                  value={l.ratePlanId}
                                  onChange={(e) =>
                                    set({ ratePlanId: e.target.value })
                                  }
                                >
                                  {plans.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {l.externalId && (
                                <span
                                  className={`ota-link-state ${ok ? "ok" : "bad"}`}
                                  aria-hidden="true"
                                >
                                  <Icon
                                    name={ok ? "success-circle" : "warning"}
                                    size={16}
                                  />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {touched && (listingErrors.length > 0 || duplicate || !linked.length) && (
                    <div className="notice warning" role="alert">
                      {!linked.length && <p>Activa al menos un alojamiento.</p>}
                      {duplicate && (
                        <p>Cada ID del canal solo puede usarse una vez.</p>
                      )}
                      {listingErrors.map((e) => (
                        <p key={e}>{e}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
              {step === 4 && ota && (
                <>
                  <h3>¿Cómo trabajará la conexión?</h3>
                  <div className="ota-option is-fixed">
                    <Icon name="inbox" size={20} />
                    <span>
                      <strong>Mensajes centralizados</strong>
                      <small>{ota.messaging}</small>
                    </span>
                    <span className="ota-pill">Siempre activo</span>
                  </div>
                  <fieldset className="ota-fieldset">
                    <legend>Qué se sincroniza</legend>
                    {(
                      [
                        ["all", "Reservas, disponibilidad y precios", "Recomendado: CALA recibe las reservas y publica calendario y tarifas."],
                        ["ari", "Solo disponibilidad y precios", "Las reservas se siguen gestionando en el canal."],
                      ] as const
                    ).map(([value, title, help]) => (
                      <label
                        key={value}
                        className={`ota-option${draft.syncMode === value ? " is-selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="ota-sync"
                          checked={draft.syncMode === value}
                          onChange={() => patch({ syncMode: value })}
                        />
                        <span>
                          <strong>{title}</strong>
                          <small>{help}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="ota-fieldset">
                    <legend>Fuente de verdad</legend>
                    {(
                      [
                        ["pms", "CALA manda", "Los cambios de calendario y precio se hacen en CALA y se publican al canal."],
                        ["channel", `${ota.label} manda`, "CALA solo lee; no publica cambios hasta que lo cambies."],
                      ] as const
                    ).map(([value, title, help]) => (
                      <label
                        key={value}
                        className={`ota-option${draft.ownership === value ? " is-selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="ota-owner"
                          checked={draft.ownership === value}
                          onChange={() => patch({ ownership: value })}
                        />
                        <span>
                          <strong>{title}</strong>
                          <small>{help}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              {step === 5 && ota && (
                <>
                  <h3>Verificar y activar</h3>
                  <ul className="ota-verify">
                    {checksList.map((label, i) => (
                      <li
                        key={label}
                        className={
                          verifying > i ? "is-ok" : verifying === i ? "is-running" : ""
                        }
                      >
                        <span aria-hidden="true">
                          {verifying > i ? (
                            <Icon name="check" size={13} />
                          ) : (
                            <i />
                          )}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ul>
                  <dl className="ota-summary">
                    <div>
                      <dt>Canal</dt>
                      <dd>{ota.label}</dd>
                    </div>
                    <div>
                      <dt>{ota.account.label}</dt>
                      <dd>{draft.account.trim()}</dd>
                    </div>
                    <div>
                      <dt>Alojamientos</dt>
                      <dd>
                        {linked
                          .map(
                            (t) =>
                              `${t.name} → ${draft.links[t.id].externalId.trim()}`,
                          )
                          .join(", ")}
                      </dd>
                    </div>
                  </dl>
                  {error && (
                    <p className="notice error" role="alert">
                      {error}
                    </p>
                  )}
                </>
              )}
            </section>
            <footer className="ota-foot">
              {step > 0 ? (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => go(step - 1)}
                >
                  <Icon name="chevron-left" size={16} />
                  Atrás
                </button>
              ) : (
                <span />
              )}
              {step < 5 ? (
                step > 0 && (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => go(step + 1)}
                  >
                    Continuar
                    <Icon name="chevron-right" size={16} />
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="button primary"
                  disabled={busy || verifying < checksList.length}
                  onClick={() => void activate()}
                >
                  {busy
                    ? "Conectando…"
                    : verifying < checksList.length
                      ? "Verificando…"
                      : "Activar conexión"}
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </Modal>
  );
}
