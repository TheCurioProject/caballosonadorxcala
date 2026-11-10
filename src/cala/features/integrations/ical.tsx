"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/cala/features/workspace/context";
import { Form, Modal } from "@/cala/components/ui/primitives";
export function IcalPanel() {
  const { data } = useWorkspace();
  return <PropertyIcalPanel key={data.currentPropertyId} />;
}
function PropertyIcalPanel() {
  const fieldId = useId();
  const { data, command } = useWorkspace();
  const units = data.units.filter(
    (u) =>
      u.propertyId === data.currentPropertyId &&
      u.active &&
      data.inventoryTypes.some((t) => t.id === u.inventoryTypeId && t.active),
  );
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState("es");
  const [importId, setImportId] = useState("");
  const importJob = data.jobs.find((job) => job.id === importId);
  const token = url
    ? new URL(url, window.location.origin).searchParams.get("token")
    : "";
  const widgetUrl = token
    ? `${window.location.origin}/cala/disponibilidad/${token}?lang=${language}`
    : "";
  const embed = widgetUrl
    ? `<iframe src="${widgetUrl}" title="Disponibilidad" width="100%" height="640" loading="lazy" referrerpolicy="no-referrer" style="border:0"></iframe>`
    : "";
  return (
    <section className="panel padded" style={{ marginTop: 24 }}>
      <h3>Compartir disponibilidad</h3>
      <p className="muted">
        Calendario público para tu web y enlace iCal por unidad, sin nombres de
        huéspedes ni tarifas.{" "}
        {data.development &&
          "En desarrollo, los enlaces funcionan sólo en este equipo. "}
        La importación acepta archivos de día completo, sin recurrencias.
      </p>
      <label className="field">
        <span>Unidad del calendario</span>
        <select
          aria-label="Unidad del calendario"
          disabled={busy}
          value={unitId}
          onChange={(e) => {
            setUnitId(e.target.value);
            setUrl("");
            setImportId("");
          }}
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row wrap">
        <button
          className="button secondary"
          disabled={!unitId || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await command({ type: "ical.rotate", unitId });
              setUrl(r.secretUrl ?? "");
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          Crear / rotar enlace privado
        </button>
        <button
          className="button secondary"
          disabled={!unitId || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await command({ type: "ical.revoke", unitId });
              setUrl("");
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          Revocar enlace
        </button>
        <button
          className="button primary"
          disabled={!unitId || !data.development}
          onClick={() => setOpen(true)}
        >
          Importar iCal
        </button>
      </div>
      {!data.development && (
        <p className="muted">
          Los calendarios externos (iCal) de cada unidad se importan aquí. Los
          enlaces que ya existían siguen sincronizando automáticamente.
        </p>
      )}
      {importId && (
        <div
          className={`notice ${importJob?.status === "dead_letter" ? "error" : ""}`}
          role="status"
        >
          <div>
            <p>{importJob?.message ?? "Importación en cola"}</p>
            {importJob?.lastError && <p>{importJob.lastError}</p>}
            {importJob?.status === "completed" &&
              importJob.result.map((line) => <p key={line}>{line}</p>)}
            <Link href="/admin/actividad">Ver proceso de importación</Link>
          </div>
        </div>
      )}
      {url && (
        <div className="notice">
          <div>
            <p>
              Este enlace concede acceso al calendario de esta unidad. Puedes
              revocarlo en cualquier momento. Rotar o revocar invalida tanto
              iCal como el calendario público de esta unidad.
            </p>
            <a
              className="button secondary"
              href={url}
              download="disponibilidad.ics"
            >
              Descargar calendario privado
            </a>
            <label className="field">
              <span>Enlace privado</span>
              <input readOnly value={window.location.origin + url} />
            </label>
            <label className="field">
              <span>Idioma del calendario público</span>
              <select
                aria-label="Idioma del calendario público"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="field">
              <span>Enlace del calendario público</span>
              <input readOnly value={widgetUrl} />
            </label>
            <label className="field">
              <span id={`${fieldId}-embed`}>Código para incrustar</span>
              <textarea
                aria-labelledby={`${fieldId}-embed`}
                rows={5}
                readOnly
                value={embed}
              />
            </label>
            <p>
              Comparte únicamente con las personas o webs que elijas. Muestra
              ocupación de dos años anteriores y posteriores. Las reservas sin
              unidad asignada pueden hacer que se muestre menos disponibilidad
              hasta asignarlas.
            </p>
            <a
              className="button secondary"
              href={widgetUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir calendario público
            </a>
          </div>
        </div>
      )}
      {open && (
        <Modal title="Importar calendario iCal" onClose={() => setOpen(false)}>
          <p>
            Se crearán bloqueos de inventario. Se rechazan conflictos con
            reservas existentes. Usa el mismo nombre de calendario al
            actualizarlo.
          </p>
          <Form
            fields={[
              {
                name: "calendar",
                label: "Nombre estable del calendario",
                value: "Calendario de pruebas",
              },
              {
                name: "content",
                label: "Contenido del archivo .ics",
                type: "textarea",
                maxLength: 100000,
              },
            ]}
            submit="Revisar e importar"
            onSubmit={async (values) => {
              const job = await command({
                type: "ical.import",
                unitId,
                ...values,
              });
              setImportId(job.id);
              setOpen(false);
            }}
          />
        </Modal>
      )}
    </section>
  );
}
