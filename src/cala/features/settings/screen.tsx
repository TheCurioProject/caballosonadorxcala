"use client";
import { useState } from "react";
import { useWorkspace, api } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Icon,
  Modal,
  Form,
  Badge,
} from "@/cala/components/ui/primitives";
import {
  roleLabels,
  grants,
  roleRank,
  canManageRole,
  assignableRoles,
} from "@/cala/domain/identity/permissions";
import type { Role, Membership } from "@/cala/domain/model";
import { OrganizationForm } from "@/cala/features/onboarding/screen";
import { browserPreferences } from "@/cala/lib/browser-preferences";
import { useI18n, type Locale } from "@/cala/lib/i18n";
export function Settings() {
  const { data, can, command, select, notify } = useWorkspace();
  const { locale, setLocale, t } = useI18n();
  const [theme, setTheme] = useState(() =>
    typeof window === "undefined"
      ? "shell"
      : (browserPreferences.getItem("cala-theme") ?? "shell"),
  );
  const [fontSize, setFontSize] = useState(() =>
    typeof window === "undefined"
      ? "normal"
      : (browserPreferences.getItem("cala-font-size") ?? "normal"),
  );
  const [organization, setOrganization] = useState(false);
  const p = data.properties.find((p) => p.id === data.currentPropertyId);
  return (
    <>
      <SectionTitle
        eyebrow={t("UN ESPACIO A TU MANERA")}
        title={t("Configuración")}
        description={t(
          "Tu organización, tus preferencias y la identidad de cada propiedad.",
        )}
      />
      <section className="panel settings-section">
        <h2>{t("Apariencia")}</h2>
        <p>{t("El mismo espacio de trabajo, con una atmósfera diferente.")}</p>
        <div className="theme-grid">
          {[
            ["shell", "Shell", "#f5f2ea", "#2f7773", "#fffdf8"],
            ["ink", "CALA Ink", "#0c2020", "#70aaa5", "#142f2f"],
            ["sand", "Sand", "#eee6da", "#2f7773", "#fffaf1"],
            ["pacific", "Pacific", "#245e5b", "#f5f2ea", "#2b6b67"],
          ].map(([id, name, bg, accent, surface]) => (
            <button
              key={id}
              aria-pressed={theme === id}
              className={"theme-choice " + (theme === id ? "active" : "")}
              onClick={() => {
                setTheme(id);
                document.documentElement.dataset.theme = id;
                browserPreferences.setItem("cala-theme", id);
                notify(t("Tema {name} aplicado", { name }));
              }}
            >
              <div className="theme-preview" style={{ background: bg }}>
                <i style={{ background: accent }} />
                <span style={{ background: surface }} />
              </div>
              <strong>{name}</strong>
            </button>
          ))}
        </div>
        <div className="settings-type-grid">
          <label className="field">
            <span>{t("Densidad de escritorio")}</span>
            <select
              defaultValue={
                typeof window === "undefined"
                  ? "comfortable"
                  : (browserPreferences.getItem("cala-density") ??
                    "comfortable")
              }
              onChange={(e) => {
                document.documentElement.dataset.density = e.target.value;
                browserPreferences.setItem("cala-density", e.target.value);
              }}
            >
              <option value="comfortable">{t("Cómoda")}</option>
              <option value="compact">{t("Compacta")}</option>
            </select>
          </label>
          <div className="field">
            <span id="font-size-label">{t("Tamaño de texto")}</span>
            <div
              className="font-size-choices"
              role="radiogroup"
              aria-labelledby="font-size-label"
            >
              {(
                [
                  ["normal", "Normal", 14],
                  ["medium", "Mediano", 16],
                  ["large", "Grande", 18],
                ] as const
              ).map(([id, label, sample]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={fontSize === id}
                  className={fontSize === id ? "active" : ""}
                  onClick={() => {
                    setFontSize(id);
                    if (id === "normal")
                      delete document.documentElement.dataset.fontSize;
                    else document.documentElement.dataset.fontSize = id;
                    browserPreferences.setItem("cala-font-size", id);
                    notify(t("Tamaño de texto: {size}", { size: t(label) }));
                  }}
                >
                  <b style={{ fontSize: sample }} aria-hidden="true">
                    Aa
                  </b>
                  <small>{t(label)}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
        <small className="muted">
          {t(
            "El tamaño de texto se adapta a cada dispositivo: en calendarios y etiquetas compactas crece menos para no romper la composición.",
          )}
        </small>
      </section>
      <section className="panel settings-section">
        <h2>{t("Idioma")}</h2>
        <p>
          {t(
            "CALA detecta el idioma de tu navegador. Puedes cambiarlo en cualquier momento.",
          )}
        </p>
        <label className="field settings-language-field">
          <span>{t("Idioma de la interfaz")}</span>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>
      <section className="panel settings-section">
        <div className="row between">
          <h2>{t("Organización")}</h2>
          <button
            className="button secondary"
            onClick={() => setOrganization(true)}
          >
            <Icon name="plus" />
            {t("Crear organización")}
          </button>
        </div>
        <label className="field" style={{ marginTop: 20 }}>
          <span>{t("Organización activa")}</span>
          <select
            value={data.currentOrganizationId}
            onChange={(e) => void select(e.target.value)}
          >
            {data.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      {p && (
        <section className="panel settings-section">
          <h2>{t("Datos de {name}", { name: p.name })}</h2>
          <p>{t("Los cambios se autorizan y guardan en servidor.")}</p>
          {can("property.write") ? (
            <Form
              key={p.id + ":" + p.version}
              fields={[
                { name: "name", label: t("Nombre"), value: p.name },
                { name: "city", label: t("Ciudad"), value: p.city },
                {
                  name: "allowedOverbooking",
                  label: t("Sobreventa agrupada permitida"),
                  type: "number",
                  min: 0,
                  max: 10,
                  value: p.allowedOverbooking,
                  help: t(
                    "No autoriza solapamientos de una misma unidad física.",
                  ),
                },
                {
                  name: "policy",
                  label: t("Política"),
                  type: "textarea",
                  value: p.policy,
                },
              ]}
              onSubmit={async (v) => {
                await command({
                  type: "property.update",
                  ...v,
                  version: p.version,
                });
              }}
            />
          ) : (
            <p className="muted">
              {t("Tu rol permite consultar; no modificar esta propiedad.")}
            </p>
          )}
        </section>
      )}
      {organization && (
        <Modal
          title={t("Nueva organización")}
          onClose={() => setOrganization(false)}
        >
          <OrganizationForm onClose={() => setOrganization(false)} />
        </Modal>
      )}
    </>
  );
}
const permissionLabels: Record<string, string> = {
  "property.read": "Ver propiedad",
  "property.write": "Editar propiedad",
  "reservation.read": "Ver reservas",
  "reservation.write": "Crear y editar reservas",
  "reservation.cancel": "Cancelar reservas",
  "guest.pii.read": "Datos de huéspedes",
  "inventory.write": "Inventario",
  "rates.write": "Tarifas",
  "finance.read": "Ver finanzas",
  "finance.write": "Cobros y cargos",
  "channel.manage": "Canales",
  "migration.manage": "Migraciones",
  "team.manage": "Equipo",
  "audit.read": "Auditoría",
  "operations.write": "Limpieza y mantenimiento",
  "automation.write": "Automatizaciones",
  "report.read": "Reportes",
  "message.read": "Ver mensajes",
  "message.write": "Responder mensajes",
};
export function Team() {
  const { data, command, notify, refresh, can } = useWorkspace();
  const { t } = useI18n();
  const [editing, setEditing] = useState<Membership | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [query, setQuery] = useState("");
  const myRole =
    data.memberships.find((m) => m.userId === data.currentUser.id)?.role ??
    "viewer";
  const assignable = assignableRoles(myRole);
  const userOf = (id: string) => data.users.find((u) => u.id === id);
  const scopeLabel = (m: Membership) =>
    m.propertyIds.length
      ? m.propertyIds
          .map((id) => data.properties.find((p) => p.id === id)?.name)
          .filter(Boolean)
          .join(", ")
      : t("Todas las propiedades");
  const members = data.memberships
    .filter((m) => {
      const u = userOf(m.userId);
      return (u?.name + " " + u?.email + " " + roleLabels[m.role])
        .toLowerCase()
        .includes(query.toLowerCase());
    })
    .sort((a, b) => roleRank[b.role] - roleRank[a.role]);
  const manageable = (m: Membership) =>
    can("team.manage") &&
    m.userId !== data.currentUser.id &&
    canManageRole(myRole, m.role);
  const roleOptions = assignable.map((value) => ({
    value,
    label: t(roleLabels[value]),
  }));
  const m = editing;
  return (
    <>
      <SectionTitle
        eyebrow={t("EL EQUIPO DETRÁS DE CADA ESTANCIA")}
        title={t("Equipo y permisos")}
        description={t(
          "Añade personas, define qué pueden hacer y en qué propiedades.",
        )}
      >
        {can("team.manage") && assignable.length > 0 && (
          <button className="button primary" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            {t("Añadir miembro")}
          </button>
        )}
      </SectionTitle>
      <div className="panel">
        <div className="toolbar">
          <label className="search-input">
            <Icon name="search" />
            <input
              aria-label={t("Buscar en el equipo")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Buscar por nombre, correo o rol")}
            />
          </label>
          <span className="muted">
            {t("{count} personas", { count: data.memberships.length })}
          </span>
        </div>
        {members.map((m) => {
          const u = userOf(m.userId);
          const editable = manageable(m);
          return (
            <div
              className={"list-row team-row" + (editable ? " clickable" : "")}
              key={m.id}
              onClick={(event) => {
                if (!editable) return;
                if ((event.target as HTMLElement).closest("button, a")) return;
                setEditing(m);
              }}
            >
              <div className="row team-person">
                <span className="avatar">
                  {(u?.name ?? "?")
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <strong>
                    {u?.name ?? t("Miembro")}
                    {m.userId === data.currentUser.id && (
                      <small className="team-you"> · {t("Tú")}</small>
                    )}
                  </strong>
                  {u?.email && <small className="team-email">{u.email}</small>}
                  <p>
                    {t(roleLabels[m.role])} · {scopeLabel(m)}
                  </p>
                </div>
              </div>
              <div className="row team-actions">
                <Badge status={m.status} />
                {editable ? (
                  <button
                    className="button secondary"
                    onClick={() => setEditing(m)}
                  >
                    {t("Gestionar")}
                  </button>
                ) : (
                  <span className="muted team-locked">
                    {m.userId === data.currentUser.id
                      ? t("Tu acceso")
                      : t("Sin permiso")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel padded" style={{ marginTop: 25 }}>
        <h2>{t("Qué puede hacer cada rol")}</h2>
        <p className="muted">
          {t(
            "Cada persona gestiona solo roles por debajo del suyo. El propietario puede nombrar administradores.",
          )}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Rol")}</th>
                <th>{t("Permisos concedidos")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grants).map(([role, permissions]) => (
                <tr key={role}>
                  <td>
                    <strong>{t(roleLabels[role as Role])}</strong>
                  </td>
                  <td className="team-grants">
                    {permissions.map((p) => (
                      <span key={p} className="chip">
                        {t(permissionLabels[p] ?? p)}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {adding && (
        <Modal title={t("Añadir miembro")} onClose={() => setAdding(false)}>
          <p className="muted">
            {t(
              "Con contraseña temporal puede entrar al momento. Sin ella le enviamos un correo de invitación.",
            )}
          </p>
          <Form
            submit={t("Añadir al equipo")}
            onCancel={() => setAdding(false)}
            fields={[
              { name: "name", label: t("Nombre"), value: "" },
              { name: "email", label: t("Correo"), type: "email", value: "" },
              {
                name: "role",
                label: t("Rol"),
                type: "select",
                value: assignable.includes("front_desk")
                  ? "front_desk"
                  : assignable[0],
                options: roleOptions,
              },
              {
                name: "propertyId",
                label: t("Propiedades"),
                type: "select",
                value: "",
                required: false,
                options: [
                  { value: "", label: t("Todas las propiedades") },
                  ...data.properties.map((p) => ({
                    value: p.id,
                    label: p.name,
                  })),
                ],
              },
              {
                name: "password",
                label: t("Contraseña temporal (opcional)"),
                value: "",
                required: false,
                help: t("Mínimo 8 caracteres. Pídele que la cambie al entrar."),
              },
            ]}
            onSubmit={async (v) => {
              const password = String(v.password ?? "");
              if (password && password.length < 8)
                throw new Error(
                  t("La contraseña temporal necesita al menos 8 caracteres."),
                );
              const result = await api<{ message: string; warning?: string }>(
                "/api/team",
                {
                  method: "POST",
                  headers: { "Idempotency-Key": crypto.randomUUID() },
                  body: JSON.stringify({
                    name: v.name,
                    email: v.email,
                    role: v.role,
                    propertyIds: v.propertyId ? [v.propertyId] : [],
                    password,
                  }),
                },
              );
              await refresh();
              notify(
                t(result.warning ?? result.message),
                result.warning ? "warning" : "success",
              );
              setAdding(false);
            }}
          />
        </Modal>
      )}
      {m && (
        <Modal
          title={userOf(m.userId)?.name ?? t("Gestionar acceso")}
          onClose={() => {
            setEditing(null);
            setConfirmRemove(false);
          }}
        >
          {userOf(m.userId)?.email && (
            <p className="muted">{userOf(m.userId)?.email}</p>
          )}
          <Form
            key={m.id + m.role + m.status}
            submit={t("Guardar cambios")}
            onCancel={() => setEditing(null)}
            fields={[
              {
                name: "role",
                label: t("Rol"),
                type: "select",
                value: m.role,
                options: roleOptions,
              },
              {
                name: "status",
                label: t("Estado"),
                type: "select" as const,
                value: m.status,
                options: [
                  { value: "active", label: t("Activo") },
                  { value: "suspended", label: t("Suspendido") },
                ],
                help: t("Una cuenta suspendida no puede entrar a CALA."),
              },
              {
                name: "propertyId",
                label: t("Propiedades"),
                type: "select",
                value: m.propertyIds[0] ?? "",
                required: false,
                options: [
                  { value: "", label: t("Todas las propiedades") },
                  ...data.properties.map((p) => ({
                    value: p.id,
                    label: p.name,
                  })),
                ],
              },
            ]}
            onSubmit={async (v) => {
              await command({
                type: "team.update",
                id: m.id,
                status: v.status,
                role: v.role,
                propertyIds: v.propertyId ? [v.propertyId] : [],
              });
              setEditing(null);
            }}
          />
          <div className="team-danger">
            {confirmRemove ? (
              <>
                <p>
                  {t(
                    "¿Retirar a esta persona del equipo? Perderá el acceso de inmediato.",
                  )}
                </p>
                <div className="row">
                  <button
                    className="button secondary"
                    onClick={() => setConfirmRemove(false)}
                  >
                    {t("Cancelar")}
                  </button>
                  <button
                    className="button danger"
                    onClick={async () => {
                      try {
                        await command({ type: "team.remove", id: m.id });
                        setEditing(null);
                        setConfirmRemove(false);
                      } catch {
                        /* command() already notified */
                      }
                    }}
                  >
                    <Icon name="trash" />
                    {t("Retirar del equipo")}
                  </button>
                </div>
              </>
            ) : (
              <button
                className="button secondary team-remove"
                onClick={() => setConfirmRemove(true)}
              >
                <Icon name="trash" />
                {t("Retirar del equipo")}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
