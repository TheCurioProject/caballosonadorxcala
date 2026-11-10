"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace, api } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Icon,
  Form,
  Empty,
} from "@/cala/components/ui/primitives";
import type { Concept } from "@/cala/domain/model";
import type { AssetId } from "@/cala/assets/registry";
import { parseMoney, moneyInput } from "@/cala/domain/shared/money";
import { money } from "@/cala/lib/format";
import {
  AMENITY_CATEGORIES,
  amenityCatalog,
  amenityLabel,
  parseAmenityKeys,
  getTimeZoneGroups,
  type AmenityKey,
} from "@/cala/domain/properties/options";
import { useI18n } from "@/cala/lib/i18n";
export const conceptLabels: Record<Concept, string> = {
  entire_home: "Casa completa",
  hotel: "Hotel",
  boutique_hotel: "Hotel boutique",
  villas: "Villas",
  apartments: "Apartamentos",
  aparthotel: "Aparthotel",
  hostel: "Hostal",
  bed_and_breakfast: "Bed & breakfast",
  inn: "Posada",
  cabins: "Cabañas",
  glamping: "Glamping",
  resort: "Resort",
  camping: "Camping",
  multi_unit_complex: "Complejo de unidades",
  other: "Otro alojamiento",
};
const conceptIcon: Record<Concept, AssetId> = {
  entire_home: "entire-home",
  hotel: "hotel",
  boutique_hotel: "hotel",
  villas: "villa",
  apartments: "apartment",
  aparthotel: "apartment",
  hostel: "hostel",
  bed_and_breakfast: "property",
  inn: "property",
  cabins: "cabin",
  glamping: "glamping",
  resort: "resort",
  camping: "camping",
  multi_unit_complex: "property",
  other: "property",
};
const defaults = {
  concept: "boutique_hotel",
  name: "",
  city: "",
  address: "",
  currency: "MXN",
  timezone: "America/Mexico_City",
  unitCount: "4",
  maxOccupancy: "2",
  baseRateAmount: "2400.00",
  bedrooms: "1",
  beds: "1",
  bathrooms: "1",
  amenities: "wifi",
  sellMode: "unit",
  checkIn: "15:00",
  checkOut: "11:00",
  policy: "Cancelación flexible hasta 48 horas antes de la llegada.",
  taxPercent: "0",
  origin: "scratch",
};
export function Onboarding() {
  const { data, command, select, busy } = useWorkspace();
  const { locale, t } = useI18n();
  const router = useRouter();
  const timeZoneGroups = getTimeZoneGroups(locale);
  const draft = data.drafts[0];
  const [values, setValues] = useState<Record<string, string>>({
    ...defaults,
    ...draft?.data,
    baseRateAmount:
      draft?.data.baseRateAmount ??
      (draft?.data.baseRateMinor
        ? moneyInput(Number(draft.data.baseRateMinor))
        : defaults.baseRateAmount),
  });
  const [step, setStep] = useState(draft?.step ?? 0);
  const [status, setStatus] = useState("Guardado");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const mounted = useRef(false);
  const complete = useRef(false);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const titles = [
    "¿Qué administras?",
    "Tu punto de partida",
    "Conozcamos tu propiedad",
    "Tus espacios",
    "Tarifas y políticas",
    "Todo en su lugar",
  ];
  async function saveDraft() {
    await saving.current;
    await api("/api/commands", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        type: "onboarding.save",
        organizationId: data.currentOrganizationId,
        step,
        data: values,
      }),
    });
  }
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (complete.current) return;
    const timer = setTimeout(() => {
      if (complete.current) return;
      setStatus("Guardando…");
      saving.current = saving.current
        .catch(() => {})
        .then(() =>
          api("/api/commands", {
            method: "POST",
            headers: { "Idempotency-Key": crypto.randomUUID() },
            body: JSON.stringify({
              type: "onboarding.save",
              organizationId: data.currentOrganizationId,
              step,
              data: values,
            }),
          }),
        )
        .then(() => setStatus("Guardado"))
        .catch(() =>
          setStatus("No se pudo guardar. Reintenta antes de salir."),
        );
    }, 600);
    return () => clearTimeout(timer);
  }, [values, step, data.currentOrganizationId]);
  const update = (name: string, value: string) =>
    setValues((v) => ({ ...v, [name]: value }));
  const selectedAmenities = parseAmenityKeys(values.amenities);
  const toggleAmenity = (key: AmenityKey) => {
    const next = new Set(selectedAmenities);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update("amenities", [...next].join(","));
  };
  const field = (name: string, label: string, type = "text") => (
    <label className="field" key={name}>
      <span>{t(label)}</span>
      <input
        name={name}
        type={type}
        value={values[name]}
        onChange={(e) => update(name, e.target.value)}
        required
        min={type === "number" ? 0 : undefined}
      />
    </label>
  );
  if (done)
    return (
      <div className="wizard panel">
        <Empty
          asset="setup-complete"
          title={t("Tu propiedad está lista")}
          description={t(
            "Continúa con tu operación o completa las conexiones cuando estén disponibles.",
          )}
        >
          <button
            className="button primary"
            onClick={() => router.push("/admin/inicio")}
          >
            {t("Ir a mi propiedad")}
          </button>
        </Empty>
      </div>
    );
  return (
    <>
      <SectionTitle
        eyebrow={t("BIENVENIDO A TU PRÓXIMO ESPACIO")}
        title={t("Configuremos tu propiedad")}
        description={t(
          "Un paso a la vez. Puedes guardar y volver cuando quieras.",
        )}
      />
      <div className="wizard panel">
        <div className="panel-heading">
          <span className="eyebrow">
            {t("PASO {step} DE {total}", {
              step: step + 1,
              total: titles.length,
            })}
          </span>
          <span className="muted" role="status" style={{ fontSize: 11 }}>
            {t(status)}
          </span>
        </div>
        <div className="progress-track" style={{ margin: "0 30px" }}>
          <div
            className="progress-fill"
            style={{ width: ((step + 1) / titles.length) * 100 + "%" }}
          />
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (step < 5) {
              if (step === 3 && Number(values.unitCount) < 1) {
                setError(t("Agrega al menos una unidad."));
                return;
              }
              setStep(step + 1);
              return;
            }
            try {
              complete.current = true;
              await saving.current;
              const r = await command({
                type: "property.create",
                name: values.name,
                concept: values.concept,
                city: values.city,
                address: values.address,
                currency: values.currency,
                timezone: values.timezone,
                unitCount: Number(values.unitCount),
                maxOccupancy: Number(values.maxOccupancy),
                baseRateMinor: parseMoney(values.baseRateAmount),
                bedrooms: Number(values.bedrooms),
                beds: Number(values.beds),
                bathrooms: Number(values.bathrooms),
                amenities: selectedAmenities,
                sellMode: values.sellMode,
                checkIn: values.checkIn,
                checkOut: values.checkOut,
                policy: values.policy,
                taxBps: parseMoney(values.taxPercent),
              });
              await select(data.currentOrganizationId, r.id);
              setDone(true);
            } catch (e) {
              complete.current = false;
              setError(
                e instanceof Error
                  ? e.message
                  : t("No se pudo crear la propiedad."),
              );
            }
          }}
        >
          <div className="wizard-body">
            <h2 style={{ marginBottom: 25, fontSize: 27 }}>
              {t(titles[step])}
            </h2>
            {step === 0 && (
              <div className="concept-grid">
                {(Object.keys(conceptLabels) as Concept[]).map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-pressed={values.concept === c}
                    className={
                      "concept-option " + (values.concept === c ? "active" : "")
                    }
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        concept: c,
                        unitCount: c === "entire_home" ? "1" : v.unitCount,
                        sellMode: c === "hostel" ? "both" : "unit",
                      }))
                    }
                  >
                    <Icon name={conceptIcon[c]} size={28} />
                    {t(conceptLabels[c])}
                  </button>
                ))}
              </div>
            )}
            {step === 1 && (
              <>
                <p className="muted">{t("Empezaremos con una base limpia.")}</p>
                <div
                  className="concept-grid"
                  style={{ gridTemplateColumns: "1fr" }}
                >
                  <button
                    type="button"
                    className="concept-option active"
                    onClick={() => update("origin", "scratch")}
                  >
                    <Icon name="property" size={32} />
                    {t("Configurar mi propiedad desde cero")}
                  </button>
                </div>
                <div className="notice">
                  {t(
                    "El asistente de CALA te guiará por los datos indispensables. Podrás completar detalles adicionales después.",
                  )}
                </div>
              </>
            )}
            {step === 2 && (
              <div className="form-grid">
                {field("name", "Nombre de tu propiedad")}
                {field("city", "Ciudad")}
                {field("address", "Dirección")}
                <label className="field">
                  <span>{t("Moneda")}</span>
                  <select
                    value={values.currency}
                    onChange={(e) => update("currency", e.target.value)}
                  >
                    <option>MXN</option>
                    <option>USD</option>
                    <option>EUR</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t("Zona horaria")}</span>
                  <select
                    value={values.timezone}
                    onChange={(e) => update("timezone", e.target.value)}
                  >
                    {timeZoneGroups.map((group) => (
                      <optgroup key={group.region} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <small>
                    {values.timezone} ·{" "}
                    {t("Usaremos esta zona para la operación diaria.")}
                  </small>
                </label>
              </div>
            )}
            {step === 3 && (
              <div className="form-grid">
                {values.concept === "hostel" && (
                  <label className="field">
                    <span>{t("¿Cómo vendes tus espacios?")}</span>
                    <select
                      value={values.sellMode}
                      onChange={(e) => update("sellMode", e.target.value)}
                    >
                      <option value="unit">{t("Por habitación")}</option>
                      <option value="bed">{t("Por cama")}</option>
                      <option value="both">
                        {t("Habitación completa y camas")}
                      </option>
                    </select>
                  </label>
                )}
                {field(
                  "unitCount",
                  values.sellMode === "both"
                    ? "Camas en el dormitorio"
                    : "Cantidad de unidades",
                  "number",
                )}
                {field("maxOccupancy", "Capacidad por unidad", "number")}
                {values.concept !== "camping" &&
                  field("bedrooms", "Dormitorios por unidad", "number")}
                {field("beds", "Camas por unidad", "number")}
                {field("bathrooms", "Baños por unidad", "number")}
                <section
                  className="amenity-selector field-full"
                  aria-labelledby="amenities-title"
                >
                  <div className="amenity-selector-heading">
                    <div>
                      <span className="eyebrow">
                        {t("LO QUE OFRECE TU PROPIEDAD")}
                      </span>
                      <h3 id="amenities-title">{t("Servicios y amenities")}</h3>
                    </div>
                    <span className="amenity-count" aria-live="polite">
                      {t("{count} seleccionadas", {
                        count: selectedAmenities.length,
                      })}
                    </span>
                  </div>
                  <p className="muted">
                    {t(
                      "Elige todas las que apliquen. Vuelve a pulsar una opción para quitarla.",
                    )}
                  </p>
                  {AMENITY_CATEGORIES.map((category) => (
                    <div className="amenity-group" key={category.key}>
                      <h4>{t(category.label)}</h4>
                      <div
                        className="amenity-bubbles"
                        role="group"
                        aria-label={t(category.label)}
                      >
                        {amenityCatalog
                          .filter(
                            (amenity) => amenity.category === category.key,
                          )
                          .map((amenity) => {
                            const selected = selectedAmenities.includes(
                              amenity.key,
                            );
                            return (
                              <button
                                type="button"
                                key={amenity.key}
                                className={
                                  "amenity-bubble " +
                                  (selected ? "selected" : "")
                                }
                                aria-pressed={selected}
                                onClick={() => toggleAmenity(amenity.key)}
                              >
                                <span className="amenity-bubble-icon">
                                  <Icon
                                    name={selected ? "check" : "plus"}
                                    size={13}
                                  />
                                </span>
                                {t(amenity.label)}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </section>
                <div className="notice">
                  {values.sellMode === "both"
                    ? t(
                        "Se creará un dormitorio y sus camas. Reservar el dormitorio bloqueará todas sus camas.",
                      )
                    : t(
                        "Podrás agregar tipos diferentes, amenities y unidades desde Inventario.",
                      )}
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="form-grid">
                {field("baseRateAmount", "Tarifa base por noche", "text")}
                {field("taxPercent", "Impuesto (%)", "text")}
                {field("checkIn", "Hora de check-in", "time")}
                {field("checkOut", "Hora de check-out", "time")}
                <label className="field field-full">
                  <span>{t("Política de la propiedad")}</span>
                  <textarea
                    value={values.policy}
                    onChange={(e) => update("policy", e.target.value)}
                    rows={3}
                  />
                </label>
                <p className="muted">
                  {t("Tarifa")}:{" "}
                  {money(
                    Math.round(Number(values.baseRateAmount || 0) * 100),
                    values.currency,
                  )}
                  .{" "}
                  {t(
                    "Sin bloqueo inicial; inventario abierto desde la creación.",
                  )}
                </p>
              </div>
            )}
            {step === 5 && (
              <>
                <dl className="details">
                  {[
                    [t("Propiedad"), values.name],
                    [
                      t("Concepto"),
                      t(conceptLabels[values.concept as Concept]),
                    ],
                    [t("Ubicación"), values.city],
                    [t("Zona horaria"), values.timezone],
                    [t("Unidades"), values.unitCount],
                    [
                      t("Servicios"),
                      selectedAmenities.length
                        ? selectedAmenities
                            .map((item) => t(amenityLabel(item)))
                            .join(" · ")
                        : t("Sin servicios seleccionados"),
                    ],
                    [
                      t("Tarifa base"),
                      money(
                        Math.round(Number(values.baseRateAmount || 0) * 100),
                        values.currency,
                      ),
                    ],
                    [t("Horarios"), values.checkIn + " / " + values.checkOut],
                    [t("Configuración"), t("Desde cero")],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="notice success">
                  {t(
                    "Datos e inventario estarán listos. Pagos y canales se conectan después; no bloquean tu operación.",
                  )}
                </div>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setStep(2)}
                >
                  {t("Editar datos")}
                </button>
              </>
            )}
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="wizard-footer">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                step > 0 ? setStep(step - 1) : router.push("/admin/inicio")
              }
            >
              {t("Atrás")}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={async () => {
                try {
                  await saveDraft();
                  router.push("/admin/inicio");
                } catch {
                  setError(
                    t(
                      "No se pudo guardar. Sigue en esta pantalla e inténtalo de nuevo.",
                    ),
                  );
                }
              }}
            >
              {t("Guardar y salir")}
            </button>
            <button className="button primary" disabled={busy}>
              {busy
                ? t("Creando…")
                : step === 5
                  ? t("Crear propiedad")
                  : t("Continuar")}
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
export function OrganizationForm({ onClose }: { onClose: () => void }) {
  const { command, select } = useWorkspace();
  const { t } = useI18n();
  return (
    <Form
      fields={[{ name: "name", label: t("Nombre de la organización") }]}
      onCancel={onClose}
      onSubmit={async (values) => {
        const result = await command({
          type: "organization.create",
          ...values,
        });
        await select(result.id);
        onClose();
      }}
    />
  );
}
