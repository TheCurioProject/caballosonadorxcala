"use client";
import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/cala/features/workspace/context";
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
import type { InventoryType, Unit } from "@/cala/domain/model";
export function Inventory() {
  const { data, can, command } = useWorkspace();
  const { t: tr } = useI18n();
  const [dialog, setDialog] = useState<"type" | "unit" | "block" | null>(null);
  const [tab, setTab] = useState("property");
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [openType, setOpenType] = useState<string | null>(null);
  const [blockUnit, setBlockUnit] = useState<string | null>(null);
  const types = data.inventoryTypes.filter(
    (t) => t.propertyId === data.currentPropertyId,
  );
  const units = data.units.filter(
    (u) => u.propertyId === data.currentPropertyId,
  );
  const blocks = data.blocks.filter(
    (b) => b.propertyId === data.currentPropertyId && b.active,
  );
  return (
    <>
      <SectionTitle
        eyebrow={tr("CADA ESPACIO TIENE SU LUGAR")}
        title={tr("Inventario")}
        description={tr(
          "Gestiona la propiedad, sus alojamientos, unidades y bloqueos. Pulsa cualquier tarjeta para ver y cambiar sus opciones.",
        )}
      >
        {can("inventory.write") && (
          <>
            <button
              className="button secondary"
              onClick={() => setDialog("block")}
            >
              <Icon name="block-room" />
              {tr("Bloquear unidad")}
            </button>
            <button
              className="button primary"
              onClick={() => setDialog("type")}
            >
              <Icon name="plus" />
              {tr("Nuevo tipo")}
            </button>
          </>
        )}
      </SectionTitle>
      <div className="tabs" role="tablist" aria-label={tr("Inventario")}>
        {[
          ["property", "Propiedad"],
          ["units", "Unidades"],
          ["types", "Tipos de inventario"],
          ["blocks", "Bloqueos"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {tr(label)}
            {id !== "property" && (
              <span>
                {id === "units"
                  ? units.length
                  : id === "types"
                    ? types.length
                    : blocks.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 22 }}>
        {tab === "property" ? (
          <PropertyManager
            onTab={setTab}
            unitCount={units.length}
            typeCount={types.length}
          />
        ) : tab === "types" ? (
          <div className="card-grid">
            {types.map((t) => (
              <button
                type="button"
                className="card card-action"
                key={t.id}
                onClick={() => setOpenType(t.id)}
                aria-label={tr("Opciones de {name}", { name: t.name })}
              >
                <Icon
                  name={t.sellMode === "bed" ? "bunk-bed" : "bed"}
                  size={30}
                />
                <h3>{t.name}</h3>
                <p>
                  {t.sellMode === "bed"
                    ? tr("Venta por cama")
                    : tr("Venta por unidad")}{" "}
                  · {tr("hasta {count} personas", { count: t.maxOccupancy })}
                </p>
                <strong>
                  {money(t.baseRateMinor)}{" "}
                  <small className="muted">/ {tr("noche base")}</small>
                </strong>
                <p>
                  {t.amenities.join(" · ") || tr("Sin amenities configuradas")}
                </p>
                <span className="card-foot">
                  <span className="muted">
                    {units.filter((u) => u.inventoryTypeId === t.id).length}{" "}
                    {tr("unidades")}
                    {!t.active && <> · {tr("Fuera de venta")}</>}
                  </span>
                  <Icon name="chevron-right" size={16} />
                </span>
              </button>
            ))}
          </div>
        ) : tab === "blocks" ? (
          <div className="panel">
            {blocks.length ? (
              blocks.map((b) => (
                <div className="list-row" key={b.id}>
                  <div>
                    <strong>
                      {units.find((u) => u.id === b.unitId)?.name} · {b.reason}
                    </strong>
                    <p>
                      {shortDate(b.arrival)} — {shortDate(b.departure)} ·{" "}
                      {tr("salida exclusiva")}
                    </p>
                  </div>
                  {can("inventory.write") && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        void command({ type: "block.release", id: b.id }).catch(
                          () => {},
                        )
                      }
                    >
                      {tr("Liberar bloqueo")}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <Empty
                title={tr("Todos los espacios, disponibles para operar")}
                description={tr("No hay bloqueos activos.")}
              />
            )}
          </div>
        ) : (
          <>
            <div className="row between" style={{ marginBottom: 18 }}>
              <span className="muted">
                {tr("La limpieza no cambia la disponibilidad de venta.")}
              </span>
              {can("inventory.write") && (
                <button
                  className="button secondary"
                  onClick={() => setDialog("unit")}
                >
                  <Icon name="plus" />
                  {tr("Agregar unidad")}
                </button>
              )}
            </div>
            <div className="card-grid">
              {units.map((u) => (
                <button
                  type="button"
                  className={
                    "card card-action" + (u.active ? "" : " is-inactive")
                  }
                  key={u.id}
                  onClick={() => setOpenUnit(u.id)}
                  aria-label={tr("Opciones de {name}", { name: u.name })}
                >
                  <div className="row between">
                    <Icon
                      name={u.parentUnitId ? "bed-single" : "door"}
                      size={26}
                    />
                    <Badge status={u.housekeeping} />
                  </div>
                  <h3>{u.name}</h3>
                  <p>{types.find((t) => t.id === u.inventoryTypeId)?.name}</p>
                  {u.parentUnitId && (
                    <small className="muted">
                      {tr("Dentro de")}{" "}
                      {units.find((p) => p.id === u.parentUnitId)?.name}
                    </small>
                  )}
                  <span className="card-foot">
                    <span className="muted">
                      {!u.active
                        ? tr("Fuera de servicio")
                        : blocks.some((b) => b.unitId === u.id)
                          ? tr("Tiene bloqueos programados")
                          : tr("Sin bloqueos programados")}
                    </span>
                    <Icon name="chevron-right" size={16} />
                  </span>
                </button>
              ))}
            </div>
            {!units.length && (
              <Empty
                title={tr("Crea tus primeros espacios")}
                description={tr(
                  "Añade un tipo de inventario con sus unidades.",
                )}
              />
            )}
          </>
        )}
      </div>
      {openUnit && units.some((u) => u.id === openUnit) && (
        <UnitDialog
          unit={units.find((u) => u.id === openUnit)!}
          types={types}
          onBlock={() => {
            setBlockUnit(openUnit);
            setOpenUnit(null);
            setDialog("block");
          }}
          onClose={() => setOpenUnit(null)}
        />
      )}
      {openType && types.some((t) => t.id === openType) && (
        <TypeDialog
          type={types.find((t) => t.id === openType)!}
          onClose={() => setOpenType(null)}
        />
      )}
      {dialog && (
        <Modal
          title={
            dialog === "type"
              ? tr("Nuevo tipo de inventario")
              : dialog === "unit"
                ? tr("Agregar unidad")
                : tr("Bloquear unidad")
          }
          onClose={() => {
            setDialog(null);
            setBlockUnit(null);
          }}
        >
          {dialog === "type" ? (
            <Form
              fields={[
                { name: "name", label: tr("Nombre del tipo") },
                {
                  name: "sellMode",
                  label: tr("Se vende por"),
                  type: "select",
                  value: "unit",
                  options: [
                    { value: "unit", label: tr("Unidad completa") },
                    { value: "bed", label: tr("Cama") },
                  ],
                },
                {
                  name: "maxOccupancy",
                  label: tr("Capacidad máxima"),
                  type: "number",
                  value: 2,
                  min: 1,
                },
                {
                  name: "baseRateMinor",
                  label: tr("Tarifa base"),
                  type: "money",
                  value: 240000,
                  min: 0,
                  help: tr("Precio por noche, por ejemplo 2400.00"),
                },
                {
                  name: "unitCount",
                  label: tr("Unidades a crear"),
                  type: "number",
                  value: 1,
                  min: 1,
                  max: 100,
                },
                {
                  name: "parentUnitId",
                  label: tr("Habitación contenedora (camas)"),
                  type: "select",
                  value: "",
                  options: [
                    { value: "", label: tr("Sin habitación contenedora") },
                    ...units
                      .filter((u) => !u.parentUnitId)
                      .map((u) => ({ value: u.id, label: u.name })),
                  ],
                  required: false,
                },
                {
                  name: "amenities",
                  label: tr("Amenities"),
                  required: false,
                  help: tr("Separadas por coma"),
                },
              ]}
              onCancel={() => setDialog(null)}
              onSubmit={async (v) => {
                await command({
                  type: "inventory.create",
                  ...v,
                  parentUnitId: v.parentUnitId || null,
                  amenities: String(v.amenities)
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
                setDialog(null);
              }}
            />
          ) : dialog === "unit" ? (
            <Form
              fields={[
                { name: "name", label: tr("Nombre de la unidad") },
                {
                  name: "inventoryTypeId",
                  label: tr("Tipo"),
                  type: "select",
                  value: types[0]?.id,
                  options: types.map((t) => ({ value: t.id, label: t.name })),
                },
                {
                  name: "parentUnitId",
                  label: tr("Habitación contenedora"),
                  type: "select",
                  value: "",
                  required: false,
                  options: [
                    { value: "", label: tr("Ninguna") },
                    ...units
                      .filter((u) => !u.parentUnitId)
                      .map((u) => ({ value: u.id, label: u.name })),
                  ],
                },
              ]}
              onCancel={() => setDialog(null)}
              onSubmit={async (v) => {
                await command({
                  type: "unit.create",
                  ...v,
                  parentUnitId: v.parentUnitId || null,
                });
                setDialog(null);
              }}
            />
          ) : (
            <Form
              fields={[
                {
                  name: "unitId",
                  label: tr("Unidad"),
                  type: "select",
                  value: blockUnit ?? units[0]?.id,
                  options: units.map((u) => ({ value: u.id, label: u.name })),
                },
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
              onCancel={() => setDialog(null)}
              onSubmit={async (v) => {
                await command({ type: "block.create", ...v });
                setDialog(null);
              }}
            />
          )}
        </Modal>
      )}
    </>
  );
}

/** Everything the "Nueva propiedad" wizard registers, editable in place. */
function PropertyManager({
  onTab,
  unitCount,
  typeCount,
}: {
  onTab: (tab: string) => void;
  unitCount: number;
  typeCount: number;
}) {
  const { data, can, command } = useWorkspace();
  const { t: tr } = useI18n();
  const p = data.properties.find((x) => x.id === data.currentPropertyId);
  if (!p)
    return (
      <Empty
        title={tr("Configura tu primera propiedad")}
        description={tr("Usa «Nueva propiedad» para registrarla.")}
      />
    );
  const capacity = data.inventoryTypes
    .filter((t) => t.propertyId === p.id && t.active)
    .reduce(
      (sum, t) =>
        sum +
        t.maxOccupancy *
          data.units.filter((u) => u.inventoryTypeId === t.id && u.active)
            .length,
      0,
    );
  return (
    <div className="property-manager">
      <div className="property-summary">
        <button type="button" onClick={() => onTab("units")}>
          <strong>{unitCount}</strong>
          <span>{tr("Unidades")}</span>
        </button>
        <button type="button" onClick={() => onTab("types")}>
          <strong>{typeCount}</strong>
          <span>{tr("Tipos de alojamiento")}</span>
        </button>
        <div>
          <strong>{capacity}</strong>
          <span>{tr("Huéspedes máximos")}</span>
        </div>
        <div>
          <strong>
            {p.checkIn} · {p.checkOut}
          </strong>
          <span>{tr("Llegada · salida")}</span>
        </div>
      </div>
      <section className="panel padded">
        <h2>{tr("Datos de la propiedad")}</h2>
        <p className="muted">
          {tr(
            "Lo mismo que registras al crear una propiedad. Los cambios se guardan en la base de datos de CALA.",
          )}
        </p>
        {can("property.write") ? (
          <Form
            key={p.id + ":" + p.version}
            submit={tr("Guardar propiedad")}
            fields={[
              { name: "name", label: tr("Nombre"), value: p.name },
              {
                name: "concept",
                label: tr("Tipo de alojamiento"),
                type: "select",
                value: p.concept,
                options: Object.entries(conceptLabels).map(
                  ([value, label]) => ({ value, label: tr(label) }),
                ),
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
                help: tr(
                  "No autoriza solapamientos de una misma unidad física.",
                ),
              },
              {
                name: "policy",
                label: tr("Política de cancelación y casa"),
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
            }}
          />
        ) : (
          <dl className="details">
            <div>
              <dt>{tr("Nombre")}</dt>
              <dd>{p.name}</dd>
            </div>
            <div>
              <dt>{tr("Ciudad")}</dt>
              <dd>{p.city}</dd>
            </div>
            <div>
              <dt>{tr("Dirección")}</dt>
              <dd>{p.address || "—"}</dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  );
}

function UnitDialog({
  unit,
  types,
  onBlock,
  onClose,
}: {
  unit: Unit;
  types: InventoryType[];
  onBlock: () => void;
  onClose: () => void;
}) {
  const { data, can, command } = useWorkspace();
  const { t: tr } = useI18n();
  const type = types.find((t) => t.id === unit.inventoryTypeId);
  const blocks = data.blocks.filter((b) => b.unitId === unit.id && b.active);
  const next = data.reservations
    .filter(
      (r) =>
        r.unitId === unit.id &&
        r.departure >= data.today &&
        ["pending", "confirmed", "checked_in"].includes(r.status),
    )
    .sort((a, b) => a.arrival.localeCompare(b.arrival))
    .slice(0, 3);
  return (
    <Modal title={unit.name} onClose={onClose} wide>
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
      {can("inventory.write") ? (
        <Form
          key={unit.id + ":" + unit.version}
          submit={tr("Guardar unidad")}
          onCancel={onClose}
          fields={[
            {
              name: "name",
              label: tr("Nombre de la unidad"),
              value: unit.name,
            },
            {
              name: "inventoryTypeId",
              label: tr("Tipo de alojamiento"),
              type: "select",
              value: unit.inventoryTypeId,
              options: types.map((t) => ({ value: t.id, label: t.name })),
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
              type: "unit.update",
              id: unit.id,
              name: v.name,
              inventoryTypeId: v.inventoryTypeId,
              active: v.active,
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
          {type?.name} · {tr("Tu rol permite consultar esta unidad.")}
        </p>
      )}
      <div className="unit-blocks">
        <div className="row between">
          <h3>{tr("Bloqueos")}</h3>
          {can("inventory.write") && (
            <button className="button secondary" onClick={onBlock}>
              <Icon name="block-room" />
              {tr("Bloquear fechas")}
            </button>
          )}
        </div>
        {blocks.length ? (
          blocks.map((b) => (
            <div className="list-row" key={b.id}>
              <div>
                <strong>{b.reason}</strong>
                <p>
                  {shortDate(b.arrival)} — {shortDate(b.departure)}
                </p>
              </div>
              {can("inventory.write") && (
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
        ) : (
          <p className="muted">{tr("No hay bloqueos activos.")}</p>
        )}
      </div>
    </Modal>
  );
}

function TypeDialog({
  type,
  onClose,
}: {
  type: InventoryType;
  onClose: () => void;
}) {
  const { can, command } = useWorkspace();
  const { t: tr } = useI18n();
  return (
    <Modal title={type.name} onClose={onClose}>
      {can("inventory.write") ? (
        <Form
          key={type.id + type.baseRateMinor + type.maxOccupancy + type.name}
          submit={tr("Guardar alojamiento")}
          onCancel={onClose}
          fields={[
            { name: "name", label: tr("Nombre"), value: type.name },
            {
              name: "baseRateMinor",
              label: tr("Tarifa base por noche"),
              type: "money",
              value: type.baseRateMinor,
              help: tr(
                "Se usa en las noches sin precio propio. Ajusta precios por día en Tarifas.",
              ),
            },
            {
              name: "maxOccupancy",
              label: tr("Huéspedes máximos"),
              type: "number",
              min: 1,
              max: 100,
              value: type.maxOccupancy,
            },
            {
              name: "active",
              label: tr("Disponible para la venta"),
              type: "checkbox",
              value: type.active,
            },
          ]}
          onSubmit={async (v) => {
            await command({
              type: "inventory.update",
              id: type.id,
              name: v.name,
              baseRateMinor: v.baseRateMinor,
              maxOccupancy: v.maxOccupancy,
              active: v.active,
            });
            onClose();
          }}
        />
      ) : (
        <p className="muted">
          {tr("Tu rol permite consultar este alojamiento.")}
        </p>
      )}
      <p className="muted" style={{ marginTop: 14 }}>
        <Link href="/admin/tarifas">
          {tr("Abrir el calendario de tarifas")} →
        </Link>
      </p>
    </Modal>
  );
}
