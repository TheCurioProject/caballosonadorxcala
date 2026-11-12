"use client";
import { useState } from "react";
import { ReservationPayments } from "@/cala/features/finance/payments";
import Link from "next/link";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  Modal,
  Form,
  Badge,
  Icon,
  Empty,
  type Field,
} from "@/cala/components/ui/primitives";
import type { Guest, Reservation } from "@/cala/domain/model";
import { money, shortDate, dateTime } from "@/cala/lib/format";
import { addDays } from "@/cala/domain/shared/dates";
import { useI18n } from "@/cala/lib/i18n";
import { ReservationInvoice } from "./invoice";
export function guestName(
  guests: { id: string; firstName: string; lastName: string }[],
  id: string,
) {
  const g = guests.find((g) => g.id === id);
  return g ? `${g.firstName} ${g.lastName}` : "Huésped · acceso restringido";
}
export function ReservationForm({
  reservation,
  onClose,
  defaults,
}: {
  reservation?: Reservation;
  onClose: () => void;
  defaults?: { unitId: string; arrival: string; departure?: string };
}) {
  if (!reservation)
    return <ReservationWizard onClose={onClose} defaults={defaults} />;
  return (
    <ReservationEditor
      reservation={reservation}
      onClose={onClose}
      defaults={defaults}
    />
  );
}

function ReservationWizard({
  onClose,
  defaults,
}: {
  onClose: () => void;
  defaults?: { unitId: string; arrival: string; departure?: string };
}) {
  const { data, command } = useWorkspace();
  const { t } = useI18n();
  const types = data.inventoryTypes.filter(
    (item) => item.propertyId === data.currentPropertyId,
  );
  const plans = data.ratePlans.filter(
    (item) => item.propertyId === data.currentPropertyId,
  );
  const defaultType =
    data.units.find((unit) => unit.id === defaults?.unitId)?.inventoryTypeId ??
    types[0]?.id ??
    "";
  const [step, setStep] = useState(0);
  const [guestMode, setGuestMode] = useState<"existing" | "new">(
    data.guests.length ? "existing" : "new",
  );
  const [guestId, setGuestId] = useState(data.guests[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("MX");
  const [guestNotes, setGuestNotes] = useState("");
  const [typeId, setTypeId] = useState(defaultType);
  const [unitId, setUnitId] = useState(defaults?.unitId ?? "");
  const [ratePlanId, setRatePlanId] = useState(plans[0]?.id ?? "");
  const [status, setStatus] = useState("confirmed");
  const [arrival, setArrival] = useState(defaults?.arrival ?? data.today);
  const [departure, setDeparture] = useState(
    defaults?.departure ?? addDays(defaults?.arrival ?? data.today, 1),
  );
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState("");
  const [prepareInvoice, setPrepareInvoice] = useState(true);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedType = types.find((item) => item.id === typeId);
  const units = data.units.filter((item) => item.inventoryTypeId === typeId);
  const nights = Math.max(
    1,
    Math.round((Date.parse(departure) - Date.parse(arrival)) / 86_400_000),
  );
  const estimatedTotal = (selectedType?.baseRateMinor ?? 0) * nights;

  if (invoiceId)
    return <ReservationInvoice reservationId={invoiceId} onClose={onClose} />;

  if (!types.length || !plans.length) {
    return (
      <Modal title={t("Nueva reserva")} onClose={onClose}>
        <Empty
          title={t("Falta configurar el inventario")}
          description={t(
            "Configura al menos un tipo de alojamiento antes de crear una reserva.",
          )}
        >
          <Link
            href="/admin/inventario"
            className="button primary"
            onClick={onClose}
          >
            {t("Ir a inventario")}
          </Link>
        </Empty>
      </Modal>
    );
  }

  const stepMeta = [
    {
      title: t("Selección de huésped"),
      copy: t(
        "Elige un huésped existente o registra sus datos sin salir de la reserva.",
      ),
    },
    {
      title: t("Datos de estancia"),
      copy: t(
        "Define fechas, alojamiento y ocupación. CALA validará disponibilidad y precio.",
      ),
    },
    {
      title: t("Resumen e invoice"),
      copy: t(
        "Revisa la reserva antes de crearla. Puedes preparar el invoice automáticamente.",
      ),
    },
  ];

  async function submitReservation() {
    setBusy(true);
    setError("");
    try {
      let finalGuestId = guestId;
      if (guestMode === "new") {
        const guest = await command({
          type: "guest.save",
          firstName,
          lastName,
          email,
          phone,
          country: country.toUpperCase(),
          notes: guestNotes,
        });
        finalGuestId = guest.id;
        // A later reservation conflict must not create the same contact again on retry.
        setGuestId(guest.id);
        setGuestMode("existing");
      }
      const reservation = await command({
        type: "reservation.save",
        guestId: finalGuestId,
        inventoryTypeId: typeId,
        unitId: unitId || null,
        ratePlanId,
        status,
        arrival,
        departure,
        adults,
        children,
        notes,
      });
      if (prepareInvoice) setInvoiceId(reservation.id);
      else onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("No se pudo guardar."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t("Nueva reserva")} onClose={onClose} wide>
      <div className="reservation-wizard">
        <div
          className="wizard-progress"
          aria-label={t("Paso {step} de {total}", { step: step + 1, total: 3 })}
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={index <= step ? "active" : ""}
              aria-hidden="true"
            />
          ))}
        </div>
        <span className="eyebrow">
          {t("Paso {step} de {total}", { step: step + 1, total: 3 })}
        </span>
        <h3>{stepMeta[step].title}</h3>
        <p className="muted wizard-copy">{stepMeta[step].copy}</p>

        {step === 0 && (
          <div className="wizard-stage">
            <div
              className="segmented-control"
              role="group"
              aria-label={t("Selección de huésped")}
            >
              <button
                type="button"
                className={guestMode === "existing" ? "active" : ""}
                disabled={!data.guests.length}
                onClick={() => setGuestMode("existing")}
              >
                {t("Huésped existente")}
              </button>
              <button
                type="button"
                className={guestMode === "new" ? "active" : ""}
                onClick={() => setGuestMode("new")}
              >
                {t("Nuevo huésped")}
              </button>
            </div>
            {guestMode === "existing" ? (
              <label className="field field-full">
                <span>{t("Huésped")}</span>
                <select
                  value={guestId}
                  onChange={(event) => setGuestId(event.target.value)}
                  required
                >
                  <option value="">{t("Selecciona un huésped")}</option>
                  {data.guests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guestName(data.guests, guest.id)} · {guest.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="form-grid wizard-form-grid">
                <WizardField
                  label={t("Nombre")}
                  value={firstName}
                  onChange={setFirstName}
                  required
                />
                <WizardField
                  label={t("Apellidos")}
                  value={lastName}
                  onChange={setLastName}
                  required
                />
                <WizardField
                  label={t("Correo electrónico")}
                  value={email}
                  onChange={setEmail}
                  type="email"
                />
                <WizardField
                  label={t("Teléfono internacional")}
                  value={phone}
                  onChange={setPhone}
                  type="tel"
                  placeholder="+525512345678"
                />
                <WizardField
                  label={t("País")}
                  value={country}
                  onChange={setCountry}
                  maxLength={2}
                  required
                />
                <label className="field">
                  <span>{t("Notas autorizadas")}</span>
                  <textarea
                    value={guestNotes}
                    onChange={(event) => setGuestNotes(event.target.value)}
                    rows={3}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="wizard-stage form-grid wizard-form-grid">
            <label className="field">
              <span>{t("Tipo de alojamiento")}</span>
              <select
                value={typeId}
                onChange={(event) => {
                  setTypeId(event.target.value);
                  setUnitId("");
                }}
              >
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} · {money(type.baseRateMinor)} / {t("noche")}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Unidad")}</span>
              <select
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
              >
                <option value="">{t("Asignar más tarde")}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Plan de tarifas")}</span>
              <select
                value={ratePlanId}
                onChange={(event) => setRatePlanId(event.target.value)}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Estado inicial")}</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="confirmed">{t("Confirmada")}</option>
                <option value="pending">{t("Pendiente")}</option>
                <option value="draft">{t("Borrador")}</option>
              </select>
            </label>
            <WizardField
              label={t("Llegada")}
              value={arrival}
              onChange={setArrival}
              type="date"
              required
            />
            <WizardField
              label={t("Salida")}
              value={departure}
              onChange={setDeparture}
              type="date"
              required
              min={addDays(arrival, 1)}
            />
            <WizardNumber
              label={t("Adultos")}
              value={adults}
              onChange={setAdults}
              min={1}
            />
            <WizardNumber
              label={t("Menores")}
              value={children}
              onChange={setChildren}
              min={0}
            />
            <label className="field field-full">
              <span>{t("Notas de la estancia")}</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-stage">
            <div className="reservation-review-grid">
              <ReviewItem
                label={t("Huésped")}
                value={
                  guestMode === "existing"
                    ? guestName(data.guests, guestId)
                    : `${firstName} ${lastName}`
                }
              />
              <ReviewItem
                label={t("Alojamiento")}
                value={selectedType?.name ?? "—"}
              />
              <ReviewItem label={t("Llegada")} value={shortDate(arrival)} />
              <ReviewItem label={t("Salida")} value={shortDate(departure)} />
              <ReviewItem
                label={t("Huésped")}
                value={String(adults + children)}
              />
              <ReviewItem label={t("Total")} value={money(estimatedTotal)} />
            </div>
            <label className="invoice-option">
              <input
                type="checkbox"
                checked={prepareInvoice}
                onChange={(event) => setPrepareInvoice(event.target.checked)}
              />
              <span className="invoice-option-icon">
                <Icon name="receipt" />
              </span>
              <span>
                <strong>{t("Preparar invoice al crear")}</strong>
                <small>
                  {t(
                    "Se abrirá una vista elegante, lista para imprimir o guardar como PDF.",
                  )}
                </small>
              </span>
            </label>
          </div>
        )}

        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <div className="wizard-actions">
          <button
            type="button"
            className="button secondary"
            onClick={
              step === 0 ? onClose : () => setStep((current) => current - 1)
            }
            disabled={busy}
          >
            {step === 0 ? t("Cancelar") : t("Atrás")}
          </button>
          {step < 2 ? (
            <button
              type="button"
              className="button primary"
              onClick={() => {
                setError("");
                if (step === 0 && guestMode === "existing" && !guestId)
                  return setError(t("Selecciona un huésped"));
                if (
                  step === 0 &&
                  guestMode === "new" &&
                  (!firstName.trim() || !lastName.trim())
                )
                  return setError(t("Nombre") + " / " + t("Apellidos"));
                if (step === 1 && departure <= arrival)
                  return setError(
                    t("La salida debe ser posterior a la llegada."),
                  );
                setStep((current) => current + 1);
              }}
            >
              {t("Continuar")} <Icon name="chevron-right" />
            </button>
          ) : (
            <button
              type="button"
              className="button primary"
              onClick={() => void submitReservation()}
              disabled={busy}
            >
              {busy
                ? t("Guardando…")
                : prepareInvoice
                  ? t("Crear reserva y generar invoice")
                  : t("Crear reserva sin invoice")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function WizardField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  maxLength,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  min?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
      />
    </label>
  );
}

function WizardNumber({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReservationEditor({
  reservation,
  onClose,
  defaults,
}: {
  reservation: Reservation;
  onClose: () => void;
  defaults?: { unitId: string; arrival: string };
}) {
  const { data, command } = useWorkspace();
  const { t } = useI18n();
  const types = data.inventoryTypes.filter(
    (t) => t.propertyId === data.currentPropertyId,
  );
  const [typeId, setTypeId] = useState(
    reservation?.inventoryTypeId ??
      data.units.find((u) => u.id === defaults?.unitId)?.inventoryTypeId ??
      types[0]?.id ??
      "",
  );
  const plans = data.ratePlans.filter(
    (p) => p.propertyId === data.currentPropertyId,
  );
  const fields: Field[] = [
    {
      name: "guestId",
      label: t("Huésped"),
      type: "select",
      value: reservation?.guestId ?? data.guests[0]?.id,
      options: data.guests.map((g) => ({
        value: g.id,
        label: guestName(data.guests, g.id),
      })),
    },
    {
      name: "unitId",
      label: t("Unidad"),
      type: "select",
      value: reservation?.unitId ?? defaults?.unitId ?? "",
      options: [
        { value: "", label: t("Asignar más tarde") },
        ...data.units
          .filter((u) => u.inventoryTypeId === typeId)
          .map((u) => ({ value: u.id, label: u.name })),
      ],
    },
    {
      name: "ratePlanId",
      label: t("Plan de tarifas"),
      type: "select",
      value: reservation?.ratePlanId ?? plans[0]?.id,
      options: plans.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      name: "status",
      label: t("Estado inicial"),
      type: "select",
      value: reservation?.status ?? "confirmed",
      options: [
        { value: "confirmed", label: t("Confirmada") },
        { value: "pending", label: t("Pendiente") },
        { value: "draft", label: t("Borrador") },
      ],
      disabled: !!reservation,
    },
    {
      name: "arrival",
      label: t("Llegada"),
      type: "date",
      value: reservation?.arrival ?? defaults?.arrival ?? data.today,
    },
    {
      name: "departure",
      label: t("Salida"),
      type: "date",
      value:
        reservation?.departure ?? addDays(defaults?.arrival ?? data.today, 1),
    },
    {
      name: "adults",
      label: t("Adultos"),
      type: "number",
      min: 1,
      value: reservation?.adults ?? 1,
    },
    {
      name: "children",
      label: t("Menores"),
      type: "number",
      min: 0,
      value: reservation?.children ?? 0,
    },
    {
      name: "notes",
      label: t("Notas de la estancia"),
      type: "textarea",
      value: reservation?.notes ?? "",
      required: false,
    },
  ];
  return (
    <Modal title={t("Editar estancia")} onClose={onClose}>
      <p className="muted">
        {t(
          "La disponibilidad y el precio se validan al guardar. Los importes usan las tarifas y restricciones de cada noche.",
        )}
      </p>
      {!data.guests.length || !types.length ? (
        <Empty
          title={t("Falta configurar el inventario")}
          description={t(
            "Configura al menos un tipo de alojamiento antes de crear una reserva.",
          )}
        />
      ) : (
        <>
          <label className="field">
            <span>{t("Tipo de alojamiento")}</span>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} · {money(type.baseRateMinor)} / {t("noche")}
                </option>
              ))}
            </select>
          </label>
          <Form
            key={typeId}
            fields={fields}
            submit={t("Guardar cambios")}
            onCancel={onClose}
            onSubmit={async (values) => {
              await command({
                type: "reservation.save",
                ...values,
                status: reservation?.status ?? values.status,
                inventoryTypeId: typeId,
                unitId: values.unitId || null,
                ...(reservation
                  ? { id: reservation.id, version: reservation.version }
                  : {}),
              });
              onClose();
            }}
          />
        </>
      )}
    </Modal>
  );
}
export function ReservationInspector({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, can, command } = useWorkspace();
  const { t } = useI18n();
  const r = data.reservations.find((r) => r.id === id);
  const [edit, setEdit] = useState(false);
  const [editGuest, setEditGuest] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!r) return null;
  if (edit)
    return <ReservationForm reservation={r} onClose={() => setEdit(false)} />;
  const guest = data.guests.find((item) => item.id === r.guestId);
  if (editGuest && guest)
    return <GuestEditor guest={guest} onClose={() => setEditGuest(false)} />;
  if (invoice)
    return (
      <ReservationInvoice
        reservationId={r.id}
        onClose={() => setInvoice(false)}
      />
    );
  const unit = data.units.find((u) => u.id === r.unitId);
  const options: rstatus[] = [];
  type rstatus =
    "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
  if (["draft", "pending"].includes(r.status)) options.push("confirmed");
  if (r.status === "confirmed") options.push("checked_in");
  if (r.status === "checked_in") options.push("checked_out");
  if (["pending", "confirmed"].includes(r.status)) options.push("no_show");
  if (["draft", "pending", "confirmed"].includes(r.status))
    options.push("cancelled");
  const labels: Record<string, string> = {
    confirmed: t("Confirmar reserva"),
    checked_in: t("Realizar check-in"),
    checked_out: t("Realizar check-out"),
    cancelled: t("Cancelar reserva"),
    no_show: t("Marcar no-show"),
  };
  return (
    <Modal title={guestName(data.guests, r.guestId)} onClose={onClose}>
      <div className="row between">
        <span className="mono">{r.confirmationCode}</span>
        <Badge status={r.status} />
      </div>
      <div className="stay-summary">
        <div>
          <small>{t("LLEGADA")}</small>
          <strong>{shortDate(r.arrival)}</strong>
        </div>
        <Icon name="chevron-right" />
        <div>
          <small>{t("SALIDA")}</small>
          <strong>{shortDate(r.departure)}</strong>
        </div>
      </div>
      <dl className="details">
        <div>
          <dt>{t("Alojamiento")}</dt>
          <dd>
            {data.inventoryTypes.find((t) => t.id === r.inventoryTypeId)?.name}
          </dd>
        </div>
        <div>
          <dt>{t("Unidad")}</dt>
          <dd>{unit?.name ?? t("Sin asignar")}</dd>
        </div>
        <div>
          <dt>{t("Huésped")}</dt>
          <dd>
            {r.adults} {t("Adultos").toLowerCase()} · {r.children}{" "}
            {t("Menores").toLowerCase()}
          </dd>
        </div>
        <div>
          <dt>{t("Origen")}</dt>
          <dd>
            {r.source === "direct" ? t("Directo") : t("Importación / canal")}
          </dd>
        </div>
      </dl>
      {can("finance.read") && <ReservationPayments reservation={r} compact />}
      {r.notes && <div className="notice">{r.notes}</div>}
      <div className="action-grid">
        {can("reservation.write") &&
          ["draft", "pending", "confirmed"].includes(r.status) && (
            <button className="button secondary" onClick={() => setEdit(true)}>
              <Icon name="edit" />
              {t("Editar / mover")}
            </button>
          )}
        {can("reservation.write") && guest && (
          <button
            className="button secondary"
            onClick={() => setEditGuest(true)}
          >
            <Icon name="guests" />
            {t("Editar datos del huésped")}
          </button>
        )}
        <button className="button secondary" onClick={() => setInvoice(true)}>
          <Icon name="receipt" />
          {t("Generar invoice")}
        </button>
        {options
          .filter((o) =>
            can(o === "cancelled" ? "reservation.cancel" : "reservation.write"),
          )
          .map((o) => (
            <button
              key={o}
              className={
                "button " + (o === "cancelled" ? "danger" : "secondary")
              }
              onClick={() => setConfirm(o)}
            >
              {labels[o]}
            </button>
          ))}
        {can("finance.read") && (
          <Link
            className="button secondary"
            href={"/admin/finanzas?reservation=" + r.id}
          >
            {t("Ver folio")}
          </Link>
        )}
      </div>
      {confirm && (
        <div className="confirmation">
          <strong>{labels[confirm]}</strong>
          <p>
            {t(
              "El cambio quedará registrado y actualizará la disponibilidad cuando corresponda.",
            )}
          </p>
          <div className="row">
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await command({
                    type: "reservation.transition",
                    id: r.id,
                    status: confirm,
                    version: r.version,
                  });
                  setConfirm(null);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : t("No se pudo guardar."),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? t("Guardando…") : t("Confirmar cambio")}
            </button>
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              {t("Volver")}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <h3 className="subheading">{t("Actividad de esta estancia")}</h3>
      <div className="timeline">
        {data.audits
          .filter((a) => a.entityId === r.id)
          .slice(-6)
          .reverse()
          .map((a) => (
            <div key={a.id}>
              <span className="status-dot" />
              <p>
                {a.detail}
                <small>{dateTime(a.createdAt)}</small>
              </p>
            </div>
          ))}
        <div>
          <span className="status-dot" />
          <p>
            {t("Reserva creada")}
            <small>{dateTime(r.createdAt)}</small>
          </p>
        </div>
      </div>
    </Modal>
  );
}

export function GuestEditor({
  guest,
  onClose,
}: {
  guest?: Guest;
  onClose: () => void;
}) {
  const { command } = useWorkspace();
  const { t } = useI18n();
  return (
    <Modal
      title={t(guest ? "Editar datos del huésped" : "Nuevo huésped")}
      onClose={onClose}
    >
      <Form
        fields={[
          {
            name: "firstName",
            label: t("Nombre"),
            value: guest?.firstName ?? "",
          },
          {
            name: "lastName",
            label: t("Apellidos"),
            value: guest?.lastName ?? "",
          },
          {
            name: "email",
            label: t("Correo electrónico"),
            type: "email" as const,
            value: guest?.email ?? "",
            required: false,
          },
          {
            name: "phone",
            label: t("Teléfono internacional"),
            type: "tel" as const,
            value: guest?.phone ?? "",
            required: false,
            help: t("Formato E.164, por ejemplo +525512345678"),
          },
          {
            name: "country",
            label: t("País"),
            value: guest?.country ?? "MX",
          },
          {
            name: "company",
            label: "Empresa",
            value: guest?.company ?? "",
            required: false,
            maxLength: 160,
          },
          {
            name: "address",
            label: "Dirección",
            value: guest?.address ?? "",
            required: false,
            maxLength: 400,
          },
          {
            name: "city",
            label: "Ciudad",
            value: guest?.city ?? "",
            required: false,
            maxLength: 160,
          },
          {
            name: "region",
            label: "Estado o provincia",
            value: guest?.region ?? "",
            required: false,
            maxLength: 160,
          },
          {
            name: "postalCode",
            label: "Código postal",
            value: guest?.postalCode ?? "",
            required: false,
            maxLength: 32,
          },
          {
            name: "language",
            label: "Idioma del huésped",
            value: guest?.language ?? "",
            required: false,
            maxLength: 35,
            help: "Por ejemplo es-MX o en. Déjalo vacío si no lo conoces.",
          },
          {
            name: "notes",
            label: t("Notas autorizadas"),
            type: "textarea" as const,
            value: guest?.notes ?? "",
            required: false,
          },
        ]}
        submit={t("Guardar huésped")}
        onCancel={onClose}
        onSubmit={async (values) => {
          await command({
            type: "guest.save",
            ...values,
            country: String(values.country).toUpperCase(),
            ...(guest ? { id: guest.id, version: guest.version } : {}),
          });
          onClose();
        }}
      />
    </Modal>
  );
}

export function ReservationTable({
  reservations,
  onSelect,
}: {
  reservations: Reservation[];
  onSelect: (id: string) => void;
}) {
  const { data, can } = useWorkspace();
  const { t } = useI18n();
  if (!reservations.length)
    return (
      <Empty
        title={t("Todo listo por aquí")}
        description={t("Los nuevos registros aparecerán en este espacio.")}
      />
    );
  return (
    <>
      <div className="table-wrap desktop-table">
        <table>
          <thead>
            <tr>
              <th>{t("Huésped")}</th>
              <th>{t("Estancia")}</th>
              <th>{t("Unidad")}</th>
              <th>{t("Estado")}</th>
              {can("finance.read") && (
                <th className="align-right">{t("Importe")}</th>
              )}
              <th>
                <span className="sr-only">{t("Abrir")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr
                key={r.id}
                className="clickable-row"
                onClick={(event) => {
                  // The whole row opens the stay; inner buttons stay for
                  // keyboard and screen-reader users.
                  if ((event.target as HTMLElement).closest("button, a"))
                    return;
                  if (window.getSelection()?.toString()) return;
                  onSelect(r.id);
                }}
              >
                <td>
                  <button
                    className="guest-button"
                    onClick={() => onSelect(r.id)}
                  >
                    <span className="avatar soft">
                      {guestName(data.guests, r.guestId)
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span>
                      <strong>{guestName(data.guests, r.guestId)}</strong>
                      <small>{r.confirmationCode}</small>
                    </span>
                  </button>
                </td>
                <td>
                  {shortDate(r.arrival)} — {shortDate(r.departure)}
                  <small>
                    {t("{count} huéspedes", { count: r.adults + r.children })}
                  </small>
                </td>
                <td>
                  {data.units.find((u) => u.id === r.unitId)?.name ??
                    t("Sin asignar")}
                  <small>
                    {
                      data.inventoryTypes.find(
                        (t) => t.id === r.inventoryTypeId,
                      )?.name
                    }
                  </small>
                </td>
                <td>
                  <Badge status={r.status} />
                </td>
                {can("finance.read") && (
                  <td className="align-right mono">
                    {money(r.totalMinor, r.currency)}
                  </td>
                )}
                <td>
                  <button
                    className="icon-button"
                    aria-label={`${t("Abrir")} ${r.confirmationCode}`}
                    onClick={() => onSelect(r.id)}
                  >
                    <Icon name="chevron-right" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-cards">
        {reservations.map((r) => (
          <button
            className="reservation-card"
            key={r.id}
            onClick={() => onSelect(r.id)}
          >
            <div className="row between">
              <strong>{guestName(data.guests, r.guestId)}</strong>
              <Badge status={r.status} />
            </div>
            <span>
              {shortDate(r.arrival)} → {shortDate(r.departure)}
            </span>
            <div className="row between">
              <small>
                {data.units.find((u) => u.id === r.unitId)?.name ??
                  t("Sin asignar")}{" "}
                · {r.confirmationCode}
              </small>
              <Icon name="chevron-right" />
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
