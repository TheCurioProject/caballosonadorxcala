"use client";
import { startNavigation } from "@/cala/components/ui/loading-layer";
import { useState, useEffect, type ReactNode } from "react";
import { uiLocale } from "@/cala/lib/format";
import { useI18n } from "@/cala/lib/i18n";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Modal } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import { navigation } from "@/cala/features/workspace/navigation";
import { WorkspaceScreen } from "@/cala/features/workspace/screen";
import { LanguageToggle } from "@/cala/components/ui/language-toggle";
import { api } from "@/cala/features/workspace/context";
import { roleLabels } from "@/cala/domain/identity/permissions";
import { InstallControl } from "@/cala/features/pwa/provider";
import { useOnline, useVirtualKeyboard } from "./device";
import { MobileCalendar } from "./calendar";
import { MobileHome } from "./home";
import { MobileReservations } from "./reservations";
import { Inbox } from "@/cala/features/messaging/screen";

export function MobileShell({
  section,
  onLogout,
  onAssistant,
  onGuide,
  children,
}: {
  section: string;
  children?: ReactNode;
  onLogout: () => void;
  onAssistant: () => void;
  onGuide: () => void;
}) {
  const {
    data,
    can,
    busy,
    select,
    syncStatus,
    syncError,
    lastRefreshedAt,
    refresh,
  } = useWorkspace();
  const { locale } = useI18n();
  const router = useRouter();
  const navigate = (href: string) => {
    startNavigation(href);
    router.push(href);
  };
  const params = useSearchParams();
  const [help, setHelp] = useState(false);
  const online = useOnline(),
    keyboard = useVirtualKeyboard();
  const [more, setMore] = useState(false),
    [properties, setProperties] = useState(false),
    [searching, setSearching] = useState(false),
    [query, setQuery] = useState("");
  const [menuSearch, setMenuSearch] = useState(""),
    [logoutError, setLogoutError] = useState("");
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearching(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const items = navigation.filter((i) => !i.permission || can(i.permission));
  const active = items.find((i) => i.path === section);
  const property = data.properties.find((p) => p.id === data.currentPropertyId);
  const tabs = items
    .filter((i) =>
      ["inicio", "calendario", "inbox", "reservas"].includes(i.path),
    )
    .sort(
      (a, b) =>
        ["inicio", "calendario", "inbox", "reservas"].indexOf(a.path) -
        ["inicio", "calendario", "inbox", "reservas"].indexOf(b.path),
    );
  const role =
    data.memberships.find(
      (m) =>
        m.userId === data.currentUser.id &&
        m.organizationId === data.currentOrganizationId &&
        m.status === "active",
    )?.role ?? "viewer";
  const stale = !online || ["offline", "error"].includes(syncStatus);
  const choose = (path: string) => {
    setMore(false);
    setSearching(false);
    navigate("/admin/" + path);
  };
  let screen: ReactNode;
  if (children) screen = <div className="site-module">{children}</div>;
  else if (!active)
    screen = (
      <div className="notice warning">
        Tu rol no tiene acceso a este módulo.
      </div>
    );
  else if (section === "inicio") screen = <MobileHome />;
  else if (section === "calendario") screen = <MobileCalendar />;
  else if (section === "reservas") screen = <MobileReservations />;
  else if (section === "inbox") screen = <Inbox compact />;
  else screen = <WorkspaceScreen section={section} />;
  return (
    <div
      className="cala-mobile-shell"
      data-keyboard-open={keyboard ? "true" : "false"}
    >
      <a className="skip-link" href="#mobile-main">
        Saltar al contenido
      </a>
      <header className="m-app-header">
        <button
          className="m-property-trigger"
          aria-label="Cambiar propiedad"
          onClick={() => setProperties(true)}
        >
          <span className="m-brand-dot" aria-hidden="true">
            <img
              src="/cala/assets/brand/cala-isotype.svg"
              alt=""
              width="24"
              height="24"
            />
          </span>
          <span>
            <small>{active?.label ?? "CALA"}</small>
            <strong>{property?.name ?? "Tu espacio"}</strong>
          </span>
          <Icon name="chevron-down" size={14} />
        </button>
        <div className="row">
          <LanguageToggle compact />
          <button
            className="m-round-button"
            aria-label="Abrir asistente de CALA"
            onClick={() => setHelp(true)}
          >
            <Icon name="help" />
          </button>
          <button
            className="m-round-button"
            aria-label="Buscar en CALA"
            onClick={() => setSearching(true)}
          >
            <Icon name="search" />
          </button>
          <Link
            className="m-round-button"
            href="/admin/actividad"
            aria-label="Activity Center"
          >
            <Icon name="notification" />
          </Link>
        </div>
      </header>
      {stale && (
        <div className="m-connection-banner" role="status">
          <Icon name="offline" size={18} />
          <span>
            <strong>
              {!online || syncStatus === "offline"
                ? "Sin conexión"
                : "Datos sin actualizar"}
            </strong>
            <small>
              Última lectura:{" "}
              {new Intl.DateTimeFormat(uiLocale(), {
                hour: "2-digit",
                minute: "2-digit",
              }).format(lastRefreshedAt)}
              . Conéctate para confirmar cambios.
            </small>
          </span>
          {online && (
            <button onClick={() => void refresh().catch(() => {})}>
              Reintentar
            </button>
          )}
        </div>
      )}
      <main
        id="mobile-main"
        className="m-app-main"
        data-section={section}
        tabIndex={-1}
        key={`${data.currentOrganizationId}:${data.currentPropertyId}:${section}:${locale}:${section === "reservas" ? params.toString() : ""}`}
      >
        {screen}
      </main>
      <nav
        className="m-tab-bar"
        aria-label="Navegación móvil"
        style={{
          gridTemplateColumns: `repeat(${tabs.length + 1},minmax(0,1fr))`,
        }}
      >
        {tabs.map((i) => (
          <Link
            key={i.path}
            href={"/admin/" + i.path}
            className={section === i.path ? "active" : ""}
            aria-current={section === i.path ? "page" : undefined}
          >
            <Icon name={i.icon} size={22} />
            <span>{i.label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMore(true)}
          className={!tabs.some((i) => i.path === section) ? "active" : ""}
          aria-label="Más herramientas"
        >
          <Icon name="more" size={22} />
          <span>Más</span>
        </button>
      </nav>
      {help && (
        <Modal title="Asistente CALA" onClose={() => setHelp(false)}>
          <div
            className="m-help-actions"
            role="menu"
            aria-label="Opciones del asistente de CALA"
          >
            <button
              role="menuitem"
              onClick={() => {
                setHelp(false);
                onGuide();
              }}
            >
              <Icon name="search" />
              <span>
                <strong>Guía de funciones</strong>
                <small>Cada sección explicada en pasos cortos.</small>
              </span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setHelp(false);
                onAssistant();
              }}
            >
              <Icon name="help" />
              <span>
                <strong>Tutorial</strong>
                <small>Conoce la interfaz, Ajustes y herramientas.</small>
              </span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setHelp(false);
                navigate("/admin/onboarding");
              }}
            >
              <Icon name="property" />
              <span>
                <strong>Primeros pasos</strong>
                <small>Configura una propiedad paso a paso.</small>
              </span>
            </button>
          </div>
        </Modal>
      )}
      {more && (
        <Modal title="Tu operación" onClose={() => setMore(false)} wide>
          <div className="m-more-account">
            <span className="avatar">{data.currentUser.name.slice(0, 1)}</span>
            <div>
              <strong>{data.currentUser.name}</strong>
              <small>{roleLabels[role]}</small>
            </div>
            <button
              className="m-round-button"
              aria-label="Abrir asistente de CALA"
              onClick={() => {
                setMore(false);
                onAssistant();
              }}
            >
              <Icon name="help" />
            </button>
          </div>
          <label className="m-search">
            <Icon name="search" />
            <input
              aria-label="Buscar herramientas"
              placeholder="¿Qué necesitas hacer?"
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
            />
          </label>
          {[...new Set(items.map((i) => i.group))].map((group) => {
            const matches = items.filter(
              (i) =>
                i.group === group &&
                i.label
                  .toLocaleLowerCase()
                  .includes(menuSearch.toLocaleLowerCase()),
            );
            return matches.length ? (
              <section className="m-tools-group" key={group}>
                <h3>{group}</h3>
                <div className="m-tools-grid">
                  {matches.map((i) => (
                    <Link
                      key={i.path}
                      href={"/admin/" + i.path}
                      onClick={() => setMore(false)}
                      aria-current={section === i.path ? "page" : undefined}
                    >
                      <span className="m-tool-icon">
                        <Icon name={i.icon} />
                      </span>
                      <strong>{i.label}</strong>
                      <Icon name="chevron-right" size={14} />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null;
          })}
          <InstallControl />
          <div className="m-account-actions">
            <button
              className="button secondary"
              onClick={() => {
                setMore(false);
                setProperties(true);
              }}
            >
              Cambiar propiedad
            </button>
            <button
              className="button secondary"
              onClick={async () => {
                setLogoutError("");
                try {
                  await api("/api/session", {
                    method: "POST",
                    body: JSON.stringify({ action: "logout" }),
                  });
                  onLogout();
                } catch {
                  setLogoutError(
                    "No pudimos cerrar la sesión. Comprueba tu conexión y vuelve a intentar.",
                  );
                }
              }}
            >
              Cerrar sesión
            </button>
          </div>
          {logoutError && (
            <p className="notice error" role="alert">
              {logoutError}
            </p>
          )}
        </Modal>
      )}
      {properties && (
        <Modal title="Tus propiedades" onClose={() => setProperties(false)}>
          <p>Selecciona dónde vas a trabajar.</p>
          <div className="m-property-list">
            {data.properties.map((p) => (
              <button
                key={p.id}
                aria-pressed={p.id === data.currentPropertyId}
                disabled={busy || !online}
                onClick={async () => {
                  await select(data.currentOrganizationId, p.id);
                  setProperties(false);
                }}
              >
                <span className="m-tool-icon">
                  <Icon name="property" />
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.city}</small>
                </span>
                {p.id === data.currentPropertyId && (
                  <Icon name="check" size={18} />
                )}
              </button>
            ))}
          </div>
          {!data.properties.length && (
            <p>No has configurado propiedades todavía.</p>
          )}
          {can("property.write") && (
            <Link
              className="button primary"
              href="/admin/onboarding"
              onClick={() => setProperties(false)}
            >
              <Icon name="plus" />
              Nueva propiedad
            </Link>
          )}
        </Modal>
      )}
      {searching && (
        <Modal title="Buscar en CALA" onClose={() => setSearching(false)}>
          <label className="field">
            <span>Buscar módulos, huésped o confirmación</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Calendario, Ana, EST…"
            />
          </label>
          <div className="palette-results">
            {items
              .filter((i) =>
                i.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
              )
              .map((i) => (
                <button key={i.path} onClick={() => choose(i.path)}>
                  <Icon name={i.icon} />
                  {i.label}
                  <Icon name="chevron-right" />
                </button>
              ))}
            {query &&
              data.reservations
                .filter(
                  (r) =>
                    r.propertyId === data.currentPropertyId &&
                    `${r.confirmationCode} ${data.guests.find((g) => g.id === r.guestId)?.firstName ?? ""} ${data.guests.find((g) => g.id === r.guestId)?.lastName ?? ""}`
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase()),
                )
                .slice(0, 8)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSearching(false);
                      navigate(`/admin/reservas?reservation=${encodeURIComponent(r.id)}`,
                      );
                    }}
                  >
                    <Icon name="reservation" />
                    {r.confirmationCode}
                    <Icon name="chevron-right" />
                  </button>
                ))}
          </div>
          {syncError && <p className="notice">{syncError}</p>}
        </Modal>
      )}
    </div>
  );
}
