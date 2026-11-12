"use client";
import { useState } from "react";
import Link from "next/link";
import { Empty, Modal, SectionTitle } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import type { MessageTemplate } from "@/cala/domain/model";
import {
  messageVariables,
  renderMessage,
  validateTemplate,
} from "@/cala/domain/messaging/templates";

export function Templates() {
  const { data } = useWorkspace();
  return <PropertyTemplates key={data.currentPropertyId} />;
}
function PropertyTemplates() {
  const { data, can, command } = useWorkspace();
  const [editing, setEditing] = useState<MessageTemplate | "new" | null>(null);
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const templates = data.messageTemplates.filter(
    (x) => x.propertyId === data.currentPropertyId,
  );
  return (
    <>
      <SectionTitle
        eyebrow="UNA BIENVENIDA A TU MEDIDA"
        title="Plantillas de mensajes"
        description="Contenido reutilizable por idioma, con variables y vista previa por estancia."
      >
        <Link href="/admin/inbox" className="button secondary">
          Volver al inbox
        </Link>
        {can("message.write") && (
          <button className="button primary" onClick={() => setEditing("new")}>
            Nueva plantilla
          </button>
        )}
      </SectionTitle>
      <div className="notice">
        Usa las plantillas al responder en Mensajes. Las reglas de fecha se
        guardan como configuración; el envío automático aún no está activo.
      </div>
      <div className="card-grid">
        {templates.map((x) => (
          <article className="card" key={x.id}>
            <span className="eyebrow">
              {x.locale} ·{" "}
              {x.trigger === "manual"
                ? "Uso manual"
                : `${x.trigger} ${x.offsetDays > 0 ? "+" : ""}${x.offsetDays} días`}
            </span>
            <h2>{x.name}</h2>
            <strong>{x.subject}</strong>
            <p className="template-excerpt">{x.body}</p>
            {can("message.write") && (
              <div className="row">
                <button
                  className="button secondary"
                  onClick={() => setEditing({ ...x })}
                >
                  Editar y previsualizar
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setError("");
                    setDeleting({ ...x });
                  }}
                >
                  Eliminar
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!templates.length && (
        <Empty
          asset="empty-messages"
          title="Prepara tu primera bienvenida"
          description="Crea plantillas para confirmación, llegada, instrucciones y despedida."
        />
      )}
      {editing && (
        <TemplateEditor
          template={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <Modal
          title="Eliminar plantilla"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>
            Se eliminará «{deleting.name}». Los mensajes que ya preparaste
            conservarán su contenido.
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await command({
                  type: "template.delete",
                  id: deleting.id,
                  version: deleting.version,
                });
                setDeleting(null);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo eliminar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Eliminando…" : "Eliminar plantilla"}
          </button>
        </Modal>
      )}
    </>
  );
}
function TemplateEditor({
  template,
  onClose,
}: {
  template?: MessageTemplate;
  onClose: () => void;
}) {
  const { data, command } = useWorkspace();
  const [name, setName] = useState(template?.name ?? "");
  const [locale, setLocale] = useState(template?.locale ?? "es");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [trigger, setTrigger] = useState(template?.trigger ?? "manual");
  const [offset, setOffset] = useState(template?.offsetDays ?? 0);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reservations = data.reservations.filter(
    (r) => r.propertyId === data.currentPropertyId,
  );
  const r = reservations.find((x) => x.id === preview);
  let previewBody = body,
    previewSubject = subject,
    validation = "";
  try {
    validateTemplate(body);
    validateTemplate(subject);
    if (r) {
      const context = {
        reservation: r,
        property: data.properties.find((p) => p.id === r.propertyId)!,
        guest: data.guests.find((g) => g.id === r.guestId),
        unit: data.units.find((u) => u.id === r.unitId),
      };
      previewBody = renderMessage(body, context);
      previewSubject = renderMessage(subject, context);
    }
  } catch (e) {
    validation = e instanceof Error ? e.message : "Variables inválidas";
  }
  return (
    <Modal
      title={template ? "Editar plantilla" : "Nueva plantilla"}
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || validation) return;
          setBusy(true);
          setError("");
          try {
            await command({
              type: "template.save",
              ...(template
                ? { id: template.id, version: template.version }
                : {}),
              name,
              locale,
              subject,
              body,
              trigger,
              offsetDays: offset,
            });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="plain-fieldset">
          <div className="form-grid">
            <label className="field">
              <span>Nombre</span>
              <input
                maxLength={160}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Idioma</span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
              >
                {[
                  "es",
                  "en",
                  "de",
                  "fr",
                  "it",
                  "pt",
                  "nl",
                  "pl",
                  "el",
                  "hu",
                ].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Asunto</span>
            <input
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Contenido en texto plano</span>
            <textarea
              required
              rows={7}
              maxLength={10000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div className="template-variables" aria-label="Insertar variable">
            {messageVariables.map((v) => (
              <button
                className="button secondary"
                type="button"
                key={v}
                onClick={() => setBody((b) => b + `{{${v}}}`)}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Evento de referencia</span>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as typeof trigger)}
              >
                <option value="manual">Solo uso manual</option>
                <option value="booking">Fecha de reserva</option>
                <option value="arrival">Llegada</option>
                <option value="departure">Salida</option>
              </select>
            </label>
            <label className="field">
              <span>Días antes (−) o después (+)</span>
              <input
                type="number"
                min={-30}
                max={30}
                value={offset}
                disabled={trigger === "manual"}
                onChange={(e) => setOffset(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="field">
            <span>Vista previa con una reserva</span>
            <select
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
            >
              <option value="">Sin datos de huésped</option>
              {reservations.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.confirmationCode}
                </option>
              ))}
            </select>
          </label>
          <article className="message-bubble internal">
            <strong>{previewSubject}</strong>
            <p>{previewBody || "Tu mensaje aparecerá aquí."}</p>
          </article>
          {(validation || error) && (
            <div className="notice error" role="alert">
              {error || validation}
            </div>
          )}
          <button
            className="button primary"
            disabled={busy || Boolean(validation)}
          >
            {busy ? "Guardando…" : "Guardar plantilla"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
