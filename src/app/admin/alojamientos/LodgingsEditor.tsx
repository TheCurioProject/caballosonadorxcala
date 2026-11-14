"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, SectionTitle } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import { getImageUrl } from "@/lib/siteImages";
import {
  lodgingPrice,
  type Lodging,
  type LodgingUpdate,
  type SalesClosure,
} from "@/lib/lodgings";
import { saveLodging, saveSalesClosure } from "./actions";

export default function LodgingsEditor({
  lodgings,
  images,
  closures,
}: {
  lodgings: Lodging[];
  images: Record<string, unknown>;
  closures: SalesClosure[];
}) {
  const [selected, setSelected] = useState(lodgings[0]?.id ?? "");
  const lodging = lodgings.find((l) => l.id === selected) ?? lodgings[0];
  const whole = lodgings.find((l) => l.kind === "whole_home");
  return (
    <>
      <SectionTitle
        eyebrow="CASA CABALLO SOÑADOR"
        title="Alojamientos y página web"
        description="La casa completa y cada habitación tienen su precio, contenido y reglas. Su disponibilidad comparte el mismo inventario."
      >
        <Link className="button secondary" href="/es/rooms/" target="_blank">
          Ver página pública
        </Link>
      </SectionTitle>
      <div className="notice" style={{ marginBottom: 20 }}>
        Una reserva de la casa completa ocupa todas sus habitaciones. Una
        habitación reservada impide vender la casa completa, y deja libres las
        demás habitaciones.
      </div>
      <div className="lodging-selector" aria-label="Alojamiento a editar">
        {lodgings.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={l.id === lodging?.id}
            className={
              "card lodging-selector-card " +
              (l.id === lodging?.id ? "selected" : "")
            }
            onClick={() => setSelected(l.id)}
          >
            <Icon name={l.kind === "whole_home" ? "home" : "bed"} size={25} />
            <strong>{l.name.es}</strong>
            <span>
              {l.kind === "whole_home" ? "Casa completa" : "Habitación"} ·{" "}
              {l.capacity} personas
            </span>
            <b>{lodgingPrice(l.baseRateMinor, l.currency)}</b>
            <small>
              {!l.published
                ? "Oculto en la web"
                : !l.enabled
                  ? "Ventas en pausa"
                  : "Visible en la web"}
            </small>
          </button>
        ))}
      </div>
      {lodging ? (
        <LodgingForm
          key={lodging.id + ":" + lodging.version}
          lodging={lodging}
          images={images}
        />
      ) : (
        <div className="panel">
          <p>El catálogo se mostrará al completar la importación.</p>
        </div>
      )}
      {whole && <Closures whole={whole} closures={closures} />}
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Continúa administrando tu casa</h2>
        <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
          {[
            ["content", "Fotografías"],
            ["servicios-comida", "Comida"],
            ["atv-tours", "ATV Tours"],
            ["cupones", "Cupones"],
            ["writers-group", "Workshops"],
            ["during-your-stay", "Amenidades"],
            ["calendario", "Calendario por habitación"],
            ["tarifas", "Tarifas por fecha"],
          ].map(([path, label]) => (
            <Link
              key={path}
              href={"/admin/" + path + "/"}
              className="button secondary"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
function LodgingForm({
  lodging,
  images,
}: {
  lodging: Lodging;
  images: Record<string, unknown>;
}) {
  const router = useRouter();
  const workspace = useWorkspace();
  const [draft, setDraft] = useState<LodgingUpdate>({
    ...lodging,
    ...(lodging.kind === "whole_home"
      ? { checkInTime: lodging.checkInTime, checkOutTime: lodging.checkOutTime }
      : {}),
  });
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const set = <K extends keyof LodgingUpdate>(
    key: K,
    value: LodgingUpdate[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));
  const translations = (
    key: "name" | "description" | "beds" | "policy",
    label: string,
    multiline = false,
  ) => (
    <div className="lodging-form-grid">
      {(["es", "en"] as const).map((lang) => (
        <label className="field" key={lang}>
          <span>
            {label} · {lang === "es" ? "Español" : "English"}
          </span>
          {multiline ? (
            <textarea
              rows={key === "description" ? 5 : 4}
              value={draft[key][lang]}
              maxLength={key === "description" ? 20000 : 10000}
              onChange={(e) =>
                set(key, { ...draft[key], [lang]: e.target.value })
              }
            />
          ) : (
            <input
              value={draft[key][lang]}
              maxLength={key === "name" ? 160 : 300}
              required={key === "name" && lang === "es"}
              onChange={(e) =>
                set(key, { ...draft[key], [lang]: e.target.value })
              }
            />
          )}
        </label>
      ))}
    </div>
  );
  const numberField = (
    key:
      | "capacity"
      | "bathrooms"
      | "minStay"
      | "maxStay"
      | "turnoverNights"
      | "leadTimeDays",
    label: string,
    min: number,
    max: number,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        required
        value={draft[key]}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </label>
  );
  return (
    <form
      className="panel lodging-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        setMessage("");
        try {
          const result = await saveLodging(draft);
          setFailed(!result.ok);
          if (result.ok) {
            setMessage("Guardado. La página pública ya usa esta información.");
            await workspace.refresh().catch(() => {});
            router.refresh();
          } else setMessage(result.message);
        } catch {
          setFailed(true);
          setMessage(
            "No se pudo guardar. Comprueba tu conexión y vuelve a intentarlo.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="row between">
        <div>
          <p className="eyebrow">
            {lodging.kind === "whole_home" ? "CASA COMPLETA" : "HABITACIÓN"}
          </p>
          <h2>{lodging.name.es}</h2>
        </div>
        <Link href="/admin/content/" className="button secondary">
          <Icon name="inventory" />
          Editar fotografías
        </Link>
      </div>
      <div className="lodging-photo-strip">
        {lodging.photoKeys
          .map((key) => ({ key, url: getImageUrl(key, images) }))
          .filter((p) => p.url)
          .map((p) => (
            <img key={p.key} src={p.url} alt={lodging.name.es} loading="lazy" />
          ))}
      </div>
      <h3>Información que aparece en la web</h3>
      {translations("name", "Nombre")}
      {translations("description", "Descripción", true)}
      {translations("beds", "Camas")}
      <div className="lodging-form-grid">
        {numberField("bathrooms", "Baños", 0, 100)}
        <label className="field">
          <span>Servicios incluidos</span>
          <input
            value={draft.amenities.join(", ")}
            onChange={(e) =>
              set(
                "amenities",
                e.target.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              )
            }
          />
          <small>Separa los servicios con comas.</small>
        </label>
      </div>
      <h3>Condiciones de reserva en la web</h3>
      <p className="muted">
        Capacidad, tarifa base y horarios de entrada y salida se gestionan en
        CALA: <Link href="/admin/inventario/">Inventario</Link>,{" "}
        <Link href="/admin/tarifas/">Tarifas y restricciones</Link> y{" "}
        <Link href="/admin/ajustes/">Configuración</Link>. Aquí solo se
        configura lo que aplica a las reservas de la página pública.
      </p>
      <div className="lodging-form-grid">
        {numberField("minStay", "Estancia mínima · noches", 1, 365)}
        {numberField("maxStay", "Estancia máxima · noches", 1, 366)}
        {numberField(
          "turnoverNights",
          "Noches de preparación entre estancias",
          0,
          7,
        )}
        {numberField("leadTimeDays", "Anticipación mínima · días", 0, 365)}
        <label className="field">
          <span>Última noche disponible para reservar</span>
          <input
            type="date"
            value={draft.openThrough ?? ""}
            onChange={(e) => set("openThrough", e.target.value || null)}
          />
          <small>
            Sin fecha límite se utiliza la tarifa base en fechas sin tarifa
            específica.
          </small>
        </label>
      </div>
      {translations(
        "policy",
        "Reglas, cancelación e información de la estancia",
        true,
      )}
      <div className="row" style={{ flexWrap: "wrap", gap: 24 }}>
        <label>
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(e) => set("published", e.target.checked)}
          />{" "}
          Mostrar en la página pública
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
          />{" "}
          Aceptar nuevas reservas
        </label>
      </div>
      {message && (
        <p role="status" className={"notice " + (failed ? "error" : "")}>
          {message}
        </p>
      )}
      <div
        className="row between"
        style={{ marginTop: 20, flexWrap: "wrap", gap: 12 }}
      >
        <p className="muted">
          Las reservas existentes se conservan al cambiar la visibilidad.
        </p>
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
function Closures({
  whole,
  closures,
}: {
  whole: Lodging;
  closures: SalesClosure[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SalesClosure | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [release, setRelease] = useState<number | null>(null);
  async function perform(payload: Parameters<typeof saveSalesClosure>[0]) {
    setBusy(true);
    setMessage("");
    try {
      const result = await saveSalesClosure(payload);
      if (result.ok) {
        setEditing(null);
        setRelease(null);
        setMessage("Calendario de la casa completa actualizado.");
        router.refresh();
      } else setMessage(result.message);
    } catch {
      setMessage("No se pudo actualizar el calendario. Revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2>Cierres de venta de la casa completa</h2>
      <p className="muted">
        Estos cierres impiden nuevas reservas de la casa completa. Las
        habitaciones mantienen sus propios calendarios. Para cerrar físicamente
        un espacio, usa «Bloquear unidad» en Inventario.
      </p>
      <form
        key={editing?.id ?? "new"}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void perform({
            lodgingId: whole.id,
            ...(editing
              ? { id: editing.id, updatedAt: editing.updatedAt }
              : {}),
            startDate: String(f.get("startDate")),
            endDate: String(f.get("endDate")),
            reason: String(f.get("reason")),
          });
        }}
      >
        <div className="lodging-form-grid">
          <label className="field">
            <span>Desde</span>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={editing?.startDate}
            />
          </label>
          <label className="field">
            <span>Hasta · incluida esta noche</span>
            <input
              type="date"
              name="endDate"
              required
              defaultValue={editing?.endDate}
            />
          </label>
          <label className="field">
            <span>Motivo</span>
            <input
              name="reason"
              maxLength={500}
              defaultValue={editing?.reason}
            />
          </label>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <button className="button primary" disabled={busy}>
            {busy
              ? "Guardando…"
              : editing
                ? "Actualizar cierre"
                : "Añadir cierre"}
          </button>
          {editing && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <details style={{ marginTop: 24 }}>
        <summary>
          {closures.length} cierres conservados · ver y editar fechas
        </summary>
        <div className="lodging-closures">
          {closures.map((c) => (
            <div key={c.id} className="list-row">
              <div>
                <strong>
                  {c.startDate} — {c.endDate}
                </strong>
                <p>{c.reason}</p>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(c);
                    setRelease(null);
                  }}
                >
                  Editar
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (release === c.id)
                      void perform({
                        lodgingId: whole.id,
                        id: c.id,
                        updatedAt: c.updatedAt,
                        remove: true,
                      });
                    else setRelease(c.id);
                  }}
                >
                  {release === c.id
                    ? "Confirmar apertura de fechas"
                    : "Liberar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
