"use client";
import { useState } from "react";
import Link from "next/link";
import {
  PropertyWorkspace,
  useWorkspace,
} from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Icon,
  Modal,
  Form,
  Badge,
  Empty,
} from "@/cala/components/ui/primitives";
import { money, shortDate } from "@/cala/lib/format";
import { addDays } from "@/cala/domain/shared/dates";
import { useI18n } from "@/cala/lib/i18n";
import { conceptLabels } from "@/cala/features/onboarding/screen";
import type {
  InventoryType,
  Property,
  RentalMode,
  Unit,
} from "@/cala/domain/model";

/**
 * Inventory is the property manager: every house of the portfolio, its rooms,
 * and each room's own settings. Prices per night live in Tarifas; reservations
 * in the calendar. Nothing here repeats those screens.
 */
export function Inventory() {
  const { data, can } = useWorkspace();
  const { t: tr } = useI18n();
  const [open, setOpen] = useState<string[]>(() =>
    data.currentPropertyId ? [data.currentPropertyId] : [],
  );
  const properties = [...data.properties].sort(
    (a, b) =>
      Number(b.id === data.currentPropertyId) -
        Number(a.id === data.currentPropertyId) || a.name.localeCompare(b.name),
  );
  return (
    <>
      <SectionTitle
        eyebrow={tr("CADA ESPACIO TIENE SU LUGAR")}
        title={tr("Inventario")}
        description={tr(
          "Tus casas y sus habitaciones. Abre una casa para ver sus habitaciones y pulsa una habitación para cambiar sus ajustes.",
        )}
      >
        {can("property.write") && (
          <Link className="button secondary" href="/admin/onboarding">
            <Icon name="plus" />
            {tr("Nueva propiedad")}
          </Link>
        )}
      </SectionTitle>
      {properties.length ? (
        <div className="pm-list">
          {properties.map((p) => (
            <PropertyWorkspace key={p.id} propertyId={p.id}>
              <PropertyCard
                property={p}
                expanded={open.includes(p.id)}
                onToggle={() =>
                  setOpen((ids) =>
                    ids.includes(p.id)
                      ? ids.filter((id) => id !== p.id)
                      : [...ids, p.id],
                  )
                }
              />
            </PropertyWorkspace>
          ))}
        </div>
      ) : (
        <Empty
          title={tr("Configura tu primera propiedad")}
          description={tr("Usa «Nueva propiedad» para registrarla.")}
        />
      )}
    </>
  );
}

/** A house is a top-level unit that contains rooms. */
function structure(units: Unit[], propertyId: string) {
  const own = units
    .filter((u) => u.propertyId === propertyId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const houses = own.filter(
    (u) => !u.parentUnitId && own.some((r) => r.parentUnitId === u.id),
  );
  const standalone = own.filter((u) => !u.parentUnitId && !houses.includes(u));
  return { own, houses, standalone };
}

function PropertyCard({
  property: p,
  expanded,
  onToggle,
}: {
  property: Property;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data, can } = useWorkspace();
  const { t: tr } = useI18n();
  const [settings, setSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const { own, houses, standalone } = structure(data.units, p.id);
  const types = data.inventoryTypes.filter((t) => t.propertyId === p.id);
  const mode: RentalMode = p.rentalMode ?? "both";
  const roomCount = own.filter((u) => u.parentUnitId).length;
  const bodyId = "pm-body-" + p.id;
  const opened = own.find((u) => u.id === openUnit);
  return (
    <section className={"pm-property" + (expanded ? " is-open" : "")}>
      <div className="pm-head">
        <button
          type="button"
          className="pm-toggle"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <Icon name={houses.length ? "entire-home" : "property"} size={28} />
          <span className="pm-title">
            <strong>{p.name}</strong>
            <small>
              {[
                p.city,
                houses.length
                  ? tr("{count} habitaciones", { count: roomCount })
                  : tr("{count} unidades", { count: own.length }),
                houses.length ? modeLabel(mode, tr) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
          {p.websiteLinked && (
            <span className="pm-pill is-web">{tr("En la web")}</span>
          )}
          <Icon name="chevron-down" size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => setSettings(true)}
          aria-label={tr("Ajustes de {name}", { name: p.name })}
          title={tr("Ajustes de la propiedad")}
        >
          <Icon name="settings" />
        </button>
      </div>
      {expanded && (
        <div className="pm-body" id={bodyId}>
          {houses.length > 0 && <RentalModeControl property={p} mode={mode} />}
          {houses.map((house) => (
            <div className="pm-group" key={house.id}>
              <UnitRow
                unit={house}
                type={types.find((t) => t.id === house.inventoryTypeId)}
                property={p}
                house
                onOpen={() => setOpenUnit(house.id)}
              />
              <ul className="pm-rooms" aria-label={tr("Habitaciones")}>
                {own
                  .filter((u) => u.parentUnitId === house.id)
                  .map((room) => (
                    <li key={room.id}>
                      <UnitRow
                        unit={room}
                        type={types.find((t) => t.id === room.inventoryTypeId)}
                        property={p}
                        onOpen={() => setOpenUnit(room.id)}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          {standalone.length > 0 && (
            <ul className="pm-rooms pm-standalone">
              {standalone.map((u) => (
                <li key={u.id}>
                  <UnitRow
                    unit={u}
                    type={types.find((t) => t.id === u.inventoryTypeId)}
                    property={p}
                    onOpen={() => setOpenUnit(u.id)}
                  />
                </li>
              ))}
            </ul>
          )}
          {!own.length && (
            <p className="muted">
              {tr("Esta propiedad aún no tiene espacios.")}
            </p>
          )}
          {can("inventory.write") && (
            <div className="pm-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setAdding(true)}
              >
                <Icon name="plus" />
                {houses.length || standalone.length
                  ? tr("Registrar habitación")
                  : tr("Registrar casa o habitación")}
              </button>
              <Link className="pm-link" href="/admin/tarifas">
                {tr("Precios por noche en Tarifas")} →
              </Link>
            </div>
          )}
        </div>
      )}
      {settings && (
        <Modal
          title={tr("Ajustes de {name}", { name: p.name })}
          onClose={() => setSettings(false)}
          wide
        >
          <PropertySettings property={p} onDone={() => setSettings(false)} />
        </Modal>
      )}
      {adding && (
        <AddRoomDialog
          property={p}
          parents={[...houses, ...standalone]}
          defaultParent={houses[0]?.id ?? ""}
          onClose={() => setAdding(false)}
        />
      )}
      {opened && (
        <RoomDialog
          unit={opened}
          type={types.find((t) => t.id === opened.inventoryTypeId)}
          isHouse={houses.includes(opened)}
          onClose={() => setOpenUnit(null)}
        />
      )}
    </section>
  );
}

function modeLabel(mode: RentalMode, tr: (s: string) => string) {
  return mode === "whole"
    ? tr("Solo casa completa")
    : mode === "rooms"
      ? tr("Solo por habitaciones")
      : tr("Casa completa y por habitaciones");
}

function RentalModeControl({
  property,
  mode,
}: {
  property: Property;
  mode: RentalMode;
}) {
  const { can, command } = useWorkspace();
  const { t: tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options: { value: RentalMode; label: string; hint: string }[] = [
    {
      value: "whole",
      label: tr("Solo casa completa"),
      hint: tr("Las habitaciones no se venden por separado."),
    },
    {
      value: "rooms",
      label: tr("Solo habitaciones"),
      hint: tr("La casa completa no se vende."),
    },
    {
      value: "both",
      label: tr("Casa y habitaciones"),
      hint: tr("Se vende la casa entera o cada habitación."),
    },
  ];
  return (
    <div className="pm-mode">
      <span className="eyebrow" id={"mode-" + property.id}>
        {tr("¿CÓMO SE RENTA?")}
      </span>
      <div
        className="pm-segments"
        role="radiogroup"
        aria-labelledby={"mode-" + property.id}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            className={mode === o.value ? "active" : ""}
            disabled={busy || !can("inventory.write")}
            onClick={async () => {
              if (mode === o.value) return;
              setBusy(true);
              setError("");
              try {
                await command({ type: "property.rentalMode", mode: o.value });
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : tr("No se pudo guardar."),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <strong>{o.label}</strong>
            <small>{o.hint}</small>
          </button>
        ))}
      </div>
      {property.websiteLinked && (
        <p className="muted pm-note">
          {tr(
            "Esta casa se publica en la página web: lo que dejes de vender aquí también deja de ofrecerse allí.",
          )}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Whether a room or house is currently offered for sale, and why not. */
function saleState(
  unit: Unit,
  type: InventoryType | undefined,
  property: Property,
  house: boolean,
  tr: (s: string) => string,
) {
  const mode = property.rentalMode ?? "both";
  if (!unit.active) return { on: false, label: tr("Fuera de servicio") };
  if (house && mode === "rooms")
    return { on: false, label: tr("No se renta completa") };
  if (unit.parentUnitId && mode === "whole")
    return { on: false, label: tr("Solo casa completa") };
  if (type && !type.active) return { on: false, label: tr("Fuera de venta") };
  return { on: true, label: tr("En venta") };
}

function UnitRow({
  unit,
  type,
  property,
  house = false,
  onOpen,
}: {
  unit: Unit;
  type?: InventoryType;
  property: Property;
  house?: boolean;
  onOpen: () => void;
}) {
  const { t: tr } = useI18n();
  const sale = saleState(unit, type, property, house, tr);
  return (
    <button
      type="button"
      className={
        "pm-row" + (house ? " is-house" : "") + (sale.on ? "" : " is-off")
      }
      onClick={onOpen}
      aria-label={tr("Ajustes de {name}", { name: unit.name })}
    >
      <Icon
        name={house ? "entire-home" : unit.parentUnitId ? "bed" : "door"}
        size={24}
      />
      <span className="pm-row-name">
        <strong>
          {house ? tr("Casa completa") + " · " + unit.name : unit.name}
        </strong>
        <small>
          {type
            ? tr("hasta {count} personas", { count: type.maxOccupancy }) +
              " · " +
              money(type.baseRateMinor) +
              " / " +
              tr("noche base")
            : ""}
        </small>
      </span>
      <Badge status={unit.housekeeping} />
      <span className={"pm-pill" + (sale.on ? " is-on" : "")}>
        {sale.label}
      </span>
      <Icon name="chevron-right" size={16} />
    </button>
  );
}

function AddRoomDialog({
  property,
  parents,
  defaultParent,
  onClose,
}: {
  property: Property;
  parents: Unit[];
  defaultParent: string;
  onClose: () => void;
}) {
  const { command } = useWorkspace();
  const { t: tr } = useI18n();
  return (
    <Modal
      title={tr("Registrar en {name}", { name: property.name })}
      onClose={onClose}
    >
      <Form
        submit={tr("Registrar")}
        onCancel={onClose}
        fields={[
          { name: "name", label: tr("Nombre"), maxLength: 160 },
          {
            name: "parentUnitId",
            label: tr("Dentro de"),
            type: "select",
            value: defaultParent,
            required: false,
            options: [
              ...parents.map((u) => ({
                value: u.id,
                label: tr("Habitación de {name}", { name: u.name }),
              })),
              {
                value: "",
                label: tr("Ninguna: es una casa o unidad independiente"),
              },
            ],
            help: tr(
              "Para rentar una casa entera y también por habitaciones, registra primero la casa y después sus habitaciones dentro de ella.",
            ),
          },
          {
            name: "maxOccupancy",
            label: tr("Huéspedes máximos"),
            type: "number",
            value: 2,
            min: 1,
            max: 100,
          },
          {
            name: "baseRateMinor",
            label: tr("Tarifa base por noche"),
            type: "money",
            value: 0,
            min: 0,
            help: tr("Se usa en las noches sin precio propio en Tarifas."),
          },
        ]}
        onSubmit={async (v) => {
          await command({
            type: "room.create",
            name: String(v.name).trim(),
            parentUnitId: String(v.parentUnitId) || null,
            maxOccupancy: Number(v.maxOccupancy),
            baseRateMinor: Number(v.baseRateMinor),
          });
          onClose();
        }}
      />
    </Modal>
  );
}

function RoomDialog({
  unit,
  type,
  isHouse,
  onClose,
}: {
  unit: Unit;
  type?: InventoryType;
  isHouse: boolean;
  onClose: () => void;
}) {
  const { data, can, command } = useWorkspace();
  const { t: tr } = useI18n();
  const [blocking, setBlocking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const shared = data.units.filter(
    (u) => u.inventoryTypeId === unit.inventoryTypeId,
  ).length;
  const blocks = data.blocks.filter((b) => b.unitId === unit.id && b.active);
  const stays = data.reservations.filter((r) => r.unitId === unit.id);
  const next = stays
    .filter(
      (r) =>
        r.departure >= data.today &&
        ["pending", "confirmed", "checked_in"].includes(r.status),
    )
    .sort((a, b) => a.arrival.localeCompare(b.arrival))
    .slice(0, 3);
  const deletable = !isHouse && !stays.length;
  const write = can("inventory.write");
  return (
    <Modal
      title={isHouse ? tr("Casa completa") + " · " + unit.name : unit.name}
      onClose={onClose}
      wide
    >
      <div className="unit-overview">
        <div>
          <span className="eyebrow">{tr("LIMPIEZA")}</span>
          <div className="unit-housekeeping">
            {(["clean", "dirty", "inspected"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={unit.housekeeping === status ? "active" : ""}
                disabled={!can("operations.write")}
                aria-pressed={unit.housekeeping === status}
                onClick={() =>
                  unit.housekeeping !== status &&
                  void command({
                    type: "unit.clean",
                    id: unit.id,
                    status,
                    version: unit.version,
                  }).catch(() => {})
                }
              >
                <Badge status={status} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="eyebrow">{tr("PRÓXIMAS ESTANCIAS")}</span>
          {next.length ? (
            <ul className="unit-stays">
              {next.map((r) => (
                <li key={r.id}>
                  <Link href={"/admin/reservas?reservation=" + r.id}>
                    {shortDate(r.arrival)} — {shortDate(r.departure)} ·{" "}
                    {r.confirmationCode}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{tr("Sin estancias próximas.")}</p>
          )}
        </div>
      </div>

      <h3 className="pm-section">{tr("Datos")}</h3>
      {write && type ? (
        <Form
          key={
            unit.id +
            ":" +
            unit.version +
            ":" +
            type.baseRateMinor +
            ":" +
            type.maxOccupancy
          }
          submit={tr("Guardar cambios")}
          fields={[
            {
              name: "name",
              label: tr("Nombre"),
              value: unit.name,
              maxLength: 160,
            },
            {
              name: "maxOccupancy",
              label: tr("Huéspedes máximos"),
              type: "number",
              min: 1,
              max: 100,
              value: type.maxOccupancy,
              help:
                shared > 1
                  ? tr("Se aplica a las {count} unidades de este tipo.", {
                      count: shared,
                    })
                  : undefined,
            },
            {
              name: "baseRateMinor",
              label: tr("Tarifa base por noche"),
              type: "money",
              min: 0,
              value: type.baseRateMinor,
              help: tr(
                "Se usa en las noches sin precio propio. Ajusta precios por día en Tarifas.",
              ),
            },
            {
              name: "bedrooms",
              label: tr("Recámaras"),
              type: "number",
              min: 0,
              max: 50,
              value: unit.attributes?.bedrooms ?? 1,
            },
            {
              name: "beds",
              label: tr("Camas"),
              type: "number",
              min: 0,
              max: 100,
              value: unit.attributes?.beds ?? 1,
            },
            {
              name: "bathrooms",
              label: tr("Baños"),
              type: "number",
              min: 0,
              max: 50,
              value: unit.attributes?.bathrooms ?? 1,
            },
            {
              name: "active",
              label: tr("En servicio (se puede vender y asignar)"),
              type: "checkbox",
              value: unit.active,
            },
          ]}
          onSubmit={async (v) => {
            await command({
              type: "room.update",
              id: unit.id,
              name: String(v.name).trim(),
              maxOccupancy: Number(v.maxOccupancy),
              baseRateMinor: Number(v.baseRateMinor),
              active: Boolean(v.active),
              attributes: {
                bedrooms: Number(v.bedrooms),
                beds: Number(v.beds),
                bathrooms: Number(v.bathrooms),
              },
              version: unit.version,
            });
            onClose();
          }}
        />
      ) : (
        <p className="muted">
          {type
            ? tr("hasta {count} personas", { count: type.maxOccupancy }) +
              " · " +
              money(type.baseRateMinor)
            : ""}{" "}
          · {tr("Tu rol permite consultar esta unidad.")}
        </p>
      )}

      <div className="unit-blocks">
        <div className="row between">
          <h3 className="pm-section">{tr("Bloqueos")}</h3>
          {write && !blocking && (
            <button
              className="button secondary"
              onClick={() => setBlocking(true)}
            >
              <Icon name="block-room" />
              {tr("Bloquear fechas")}
            </button>
          )}
        </div>
        {blocking && (
          <Form
            submit={tr("Bloquear")}
            onCancel={() => setBlocking(false)}
            fields={[
              {
                name: "reason",
                label: tr("Motivo"),
                value: tr("Mantenimiento"),
              },
              {
                name: "arrival",
                label: tr("Desde"),
                type: "date",
                value: data.today,
              },
              {
                name: "departure",
                label: tr("Hasta (exclusivo)"),
                type: "date",
                value: addDays(data.today, 1),
              },
            ]}
            onSubmit={async (v) => {
              await command({ type: "block.create", unitId: unit.id, ...v });
              setBlocking(false);
            }}
          />
        )}
        {blocks.length
          ? blocks.map((b) => (
              <div className="list-row" key={b.id}>
                <div>
                  <strong>{b.reason}</strong>
                  <p>
                    {shortDate(b.arrival)} — {shortDate(b.departure)}
                  </p>
                </div>
                {write && (
                  <button
                    className="button secondary"
                    onClick={() =>
                      void command({ type: "block.release", id: b.id }).catch(
                        () => {},
                      )
                    }
                  >
                    {tr("Liberar")}
                  </button>
                )}
              </div>
            ))
          : !blocking && (
              <p className="muted">{tr("No hay bloqueos activos.")}</p>
            )}
      </div>

      {write && !isHouse && (
        <div className="pm-danger">
          <div>
            <strong>{tr("Eliminar habitación")}</strong>
            <p className="muted">
              {deletable
                ? tr(
                    "Se borra junto con sus precios y bloqueos. No se puede deshacer.",
                  )
                : tr(
                    "Tiene reservas en su historial, así que no se puede borrar. Desmarca «En servicio» para dejar de venderla.",
                  )}
            </p>
          </div>
          {deletable &&
            (confirmDelete ? (
              <div className="row">
                <button
                  className="button secondary"
                  onClick={() => setConfirmDelete(false)}
                >
                  {tr("Cancelar")}
                </button>
                <button
                  className="button danger"
                  onClick={async () => {
                    setError("");
                    try {
                      await command({
                        type: "room.delete",
                        id: unit.id,
                        version: unit.version,
                      });
                      onClose();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : tr("No se pudo guardar."),
                      );
                    }
                  }}
                >
                  <Icon name="trash" />
                  {tr("Sí, eliminar")}
                </button>
              </div>
            ) : (
              <button
                className="button secondary"
                onClick={() => setConfirmDelete(true)}
              >
                <Icon name="trash" />
                {tr("Eliminar")}
              </button>
            ))}
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

/** Everything the "Nueva propiedad" wizard registers, editable in place. */
function PropertySettings({
  property: p,
  onDone,
}: {
  property: Property;
  onDone: () => void;
}) {
  const { can, command } = useWorkspace();
  const { t: tr } = useI18n();
  if (!can("property.write"))
    return (
      <dl className="details">
        <div>
          <dt>{tr("Ciudad")}</dt>
          <dd>{p.city || "—"}</dd>
        </div>
        <div>
          <dt>{tr("Llegada · salida")}</dt>
          <dd>
            {p.checkIn} · {p.checkOut}
          </dd>
        </div>
        <div>
          <dt>{tr("Reglas de la casa y cancelación")}</dt>
          <dd>{p.policy || "—"}</dd>
        </div>
      </dl>
    );
  return (
    <Form
      key={p.id + ":" + p.version}
      submit={tr("Guardar propiedad")}
      onCancel={onDone}
      fields={[
        { name: "name", label: tr("Nombre"), value: p.name },
        {
          name: "concept",
          label: tr("Tipo de alojamiento"),
          type: "select",
          value: p.concept,
          options: Object.entries(conceptLabels).map(([value, label]) => ({
            value,
            label: tr(label),
          })),
        },
        { name: "city", label: tr("Ciudad"), value: p.city },
        {
          name: "address",
          label: tr("Dirección"),
          value: p.address,
          required: false,
        },
        {
          name: "checkIn",
          label: tr("Llegada desde"),
          type: "time",
          value: p.checkIn,
        },
        {
          name: "checkOut",
          label: tr("Salida hasta"),
          type: "time",
          value: p.checkOut,
        },
        {
          name: "taxPercent",
          label: tr("Impuestos (%)"),
          type: "number",
          min: 0,
          max: 100,
          step: 0.01,
          value: p.taxBps / 100,
        },
        {
          name: "allowedOverbooking",
          label: tr("Sobreventa agrupada permitida"),
          type: "number",
          min: 0,
          max: 10,
          value: p.allowedOverbooking,
          help: tr("No autoriza solapamientos de una misma unidad física."),
        },
        {
          name: "policy",
          label: tr("Reglas de la casa y cancelación"),
          type: "textarea",
          value: p.policy,
          required: false,
        },
      ]}
      onSubmit={async (v) => {
        await command({
          type: "property.update",
          name: v.name,
          concept: v.concept,
          city: v.city,
          address: v.address,
          checkIn: String(v.checkIn).slice(0, 5),
          checkOut: String(v.checkOut).slice(0, 5),
          taxBps: Math.round(Number(v.taxPercent) * 100),
          allowedOverbooking: v.allowedOverbooking,
          policy: v.policy,
          version: p.version,
        });
        onDone();
      }}
    />
  );
}
