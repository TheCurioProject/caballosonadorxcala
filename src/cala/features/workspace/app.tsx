"use client";
import { startNavigation } from "@/cala/components/ui/loading-layer";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMobileLayout } from "@/cala/features/mobile/device";
import { useRouter } from "next/navigation";
import type { Snapshot } from "@/cala/domain/model";
import { WorkspaceProvider, useWorkspace, api } from "./context";
import { WelcomeAuth } from "./login";
import { navigation } from "./navigation";
import { Icon, Modal, Skeleton } from "@/cala/components/ui/primitives";
import { CalaLogo } from "@/cala/components/brand/cala-logo";
import { CalaSplash } from "@/cala/components/ui/cala-loader";
import { CalaAssistant } from "@/cala/features/onboarding/cala-assistant";
import { CalaGuide } from "@/cala/features/onboarding/cala-guide";
import { roleLabels } from "@/cala/domain/identity/permissions";
import { WorkspaceScreen } from "./screen";
import { LanguageToggle } from "@/cala/components/ui/language-toggle";
import { scrollWorkspaceToTop } from "@/cala/lib/scroll-top";
import { browserPreferences } from "@/cala/lib/browser-preferences";
import { useI18n } from "@/cala/lib/i18n";
const MobileShell = dynamic(
  () =>
    import("@/cala/features/mobile/shell").then((module) => module.MobileShell),
  { ssr: false, loading: () => <Skeleton /> },
);
export function WorkspaceApp({
  section,
  children,
}: {
  section: string;
  children?: ReactNode;
}) {
  return <WorkspaceRoot section={section}>{children}</WorkspaceRoot>;
}
function WorkspaceRoot({
  section,
  children,
}: {
  section: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const navigate = (href: string) => {
    startNavigation(href);
    router.push(href);
  };
  const [data, setData] = useState<Snapshot | null>(null);
  const [account, setAccount] = useState<{
    authenticated: boolean;
    user?: { id: string; name: string; email: string };
    hasOrganization?: boolean;
    assistantCompleted?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await api<{
        authenticated: boolean;
        user?: { id: string; name: string; email: string };
        hasOrganization?: boolean;
        assistantCompleted?: boolean;
      }>("/api/session");
      setAccount(session);
      if (
        !session.authenticated ||
        !session.hasOrganization ||
        !session.assistantCompleted
      ) {
        setData(null);
        return;
      }
      const saved = browserPreferences.getItem("cala-scope");
      let suffix = "";
      if (saved) {
        try {
          const scope = JSON.parse(saved) as {
            organizationId: string;
            propertyId: string;
          };
          suffix = "?" + new URLSearchParams(scope).toString();
        } catch {
          browserPreferences.removeItem("cala-scope");
        }
      }
      let next: Snapshot;
      try {
        next = await api<Snapshot>("/api/workspace" + suffix);
      } catch (error) {
        if (suffix && (error as { status?: number }).status === 403) {
          browserPreferences.removeItem("cala-scope");
          next = await api<Snapshot>("/api/workspace");
        } else throw error;
      }
      setData(next);
      setError("");
    } catch (reason) {
      if ((reason as { status?: number }).status === 401) {
        setAccount({ authenticated: false });
        setData(null);
      } else {
        setError(
          reason instanceof Error
            ? reason.message
            : t("No se pudo cargar CALA."),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [t]);
  const expire = useCallback(() => {
    setData(null);
    setAccount({ authenticated: false });
    window.location.replace("/admin/login/");
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  if (loading) return <CalaSplash />;
  if (!account?.authenticated)
    return (
      <WelcomeAuth
        onAuthenticated={() => window.location.replace("/admin/inicio/")}
      />
    );
  if (!account.hasOrganization || !account.assistantCompleted)
    return (
      <CalaAssistant
        firstName={account.user?.name.split(" ")[0] ?? ""}
        requiresOrganization={!account.hasOrganization}
        onComplete={async () => {
          const firstSetup = !account.hasOrganization;
          await load();
          if (firstSetup) navigate("/admin/onboarding");
        }}
      />
    );
  if (!data)
    return (
      <main className="fatal-state">
        <CalaLogo />
        <h1>{t("No pudimos abrir tu espacio")}</h1>
        <p>{error || t("Intenta cargar CALA de nuevo.")}</p>
        <button className="button primary" onClick={() => void load()}>
          {t("Reintentar")}
        </button>
      </main>
    );
  return (
    <WorkspaceProvider initial={data} onSessionExpired={expire}>
      <Shell section={section} onLogout={expire}>
        {children}
      </Shell>
    </WorkspaceProvider>
  );
}
function Shell({
  section,
  onLogout,
  children,
}: {
  section: string;
  children?: ReactNode;
  onLogout: () => void;
}) {
  const { t, locale } = useI18n();
  const mobile = useMobileLayout();
  const { data, can, select, busy } = useWorkspace();
  const router = useRouter();
  const navigate = (href: string) => {
    startNavigation(href);
    router.push(href);
  };
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [guide, setGuide] = useState(false);
  const [assistantMenu, setAssistantMenu] = useState(false);
  const assistantMenuRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const property = data.properties.find((p) => p.id === data.currentPropertyId);
  const role =
    data.memberships.find((m) => m.userId === data.currentUser.id)?.role ??
    "viewer";
  const items = navigation.filter((n) => !n.permission || can(n.permission));
  const regularItems = items.filter((item) => !item.featured);
  const active = items.find((n) => n.path === section);
  useEffect(() => {
    if (mobile) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobile]);
  useEffect(() => {
    if (!assistantMenu) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setAssistantMenu(false);
        return;
      }
      if (!assistantMenuRef.current?.contains(event.target as Node))
        setAssistantMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [assistantMenu]);
  useEffect(() => {
    scrollWorkspaceToTop();
  }, [section, data.currentPropertyId]);
  useEffect(() => {
    const theme = browserPreferences.getItem("cala-theme");
    if (theme && ["shell", "ink", "sand", "pacific"].includes(theme))
      document.documentElement.dataset.theme = theme;
    const density = browserPreferences.getItem("cala-density");
    if (density) document.documentElement.dataset.density = density;
    const fontSize = browserPreferences.getItem("cala-font-size");
    if (fontSize && ["medium", "large"].includes(fontSize))
      document.documentElement.dataset.fontSize = fontSize;
  }, []);
  const jobs = data.jobs.filter(
    (j) => !["completed", "dead_letter"].includes(j.status),
  ).length;
  if (mobile)
    return (
      <>
        <MobileShell
          section={section}
          onLogout={onLogout}
          onAssistant={() => setAssistant(true)}
          onGuide={() => setGuide(true)}
        >
          {children}
        </MobileShell>
        {assistant && (
          <CalaAssistant
            firstName={data.currentUser.name.split(" ")[0] ?? ""}
            requiresOrganization={false}
            onComplete={() => setAssistant(false)}
            onClose={() => setAssistant(false)}
          />
        )}
        {guide && (
          <CalaGuide section={section} onClose={() => setGuide(false)} />
        )}
      </>
    );
  const sidebar = (
    <>
      <Link className="brand" href="/admin/inicio">
        <CalaLogo />
      </Link>
      <div className="property-picker">
        <label htmlFor="property-select">{t("TU PROPIEDAD")}</label>
        <select
          id="property-select"
          value={data.currentPropertyId}
          onChange={(e) =>
            void select(data.currentOrganizationId, e.target.value)
          }
          disabled={busy}
        >
          {data.properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {!data.properties.length && (
            <option value="">{t("Sin propiedades")}</option>
          )}
        </select>
        <span>{property?.city ?? t("Configura tu primera propiedad")}</span>
      </div>
      {can("property.write") && (
        <Link
          className={`new-property-cta ${section === "onboarding" ? "active" : ""}`}
          href="/admin/onboarding"
          title={t("Nueva propiedad")}
          aria-current={section === "onboarding" ? "page" : undefined}
        >
          <span className="new-property-icon">
            <Icon name="plus" />
          </span>
          <span className="new-property-copy">
            <strong>{t("Nueva propiedad")}</strong>
            <small>{t("Añadir al portafolio")}</small>
          </span>
          <Icon name="chevron-right" size={15} />
        </Link>
      )}
      <nav aria-label="Navegación principal">
        {regularItems.map((item, i) => (
          <div key={item.path}>
            {(i === 0 || regularItems[i - 1].group !== item.group) && (
              <p className="nav-group">{t(item.group)}</p>
            )}
            <Link
              title={t(item.label)}
              className={`nav-item ${section === item.path ? "active" : ""}`}
              href={"/admin/" + item.path}
              onClick={() => setMenu(false)}
              aria-current={section === item.path ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{t(item.label)}</span>
              {item.path === "actividad" && jobs > 0 && (
                <b className="nav-count">{jobs}</b>
              )}
            </Link>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="avatar">
          {data.currentUser.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <strong>{data.currentUser.name}</strong>
          <small>{roleLabels[role]}</small>
        </div>
        <button
          className="icon-button"
          aria-label={t("Cerrar sesión")}
          onClick={async () => {
            await api("/api/session", {
              method: "POST",
              body: JSON.stringify({ action: "logout" }),
            });
            onLogout();
          }}
        >
          <Icon name="logout" />
        </button>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t("Saltar al contenido")}
      </a>
      <aside className="sidebar">{sidebar}</aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label={t("Abrir navegación")}
              onClick={() => setMenu(true)}
            >
              <Icon name="menu" />
            </button>
            <span>{t("Mi espacio")}</span>
            <Icon name="chevron-right" size={14} />
            <strong>{active ? t(active.label) : "CALA"}</strong>
          </div>
          <div className="topbar-actions">
            <LanguageToggle />
            <div className="assistant-launcher" ref={assistantMenuRef}>
              <button
                className="assistant-button"
                onClick={() => setAssistantMenu((open) => !open)}
                aria-label={t("Abrir asistente de CALA")}
                aria-expanded={assistantMenu}
                aria-haspopup="menu"
                aria-controls="assistant-menu"
              >
                <span className="assistant-button-mark" aria-hidden="true">
                  <Icon name="help" size={17} />
                </span>
                <span>{t("Asistente CALA")}</span>
              </button>
              {assistantMenu && (
                <div
                  className="assistant-menu"
                  id="assistant-menu"
                  role="menu"
                  aria-label={t("Opciones del asistente de CALA")}
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      setAssistantMenu(false);
                      setGuide(true);
                    }}
                  >
                    <span className="assistant-menu-icon">
                      <Icon name="search" />
                    </span>
                    <span>
                      <strong>{t("Guía de funciones")}</strong>
                      <small>
                        {t("Cada sección explicada en pasos cortos.")}
                      </small>
                    </span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setAssistantMenu(false);
                      setAssistant(true);
                    }}
                  >
                    <span className="assistant-menu-icon">
                      <Icon name="help" />
                    </span>
                    <span>
                      <strong>{t("Tutorial")}</strong>
                      <small>
                        {t("Conoce la interfaz, Ajustes y herramientas.")}
                      </small>
                    </span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setAssistantMenu(false);
                      navigate("/admin/onboarding");
                    }}
                  >
                    <span className="assistant-menu-icon">
                      <Icon name="property" />
                    </span>
                    <span>
                      <strong>{t("Primeros pasos")}</strong>
                      <small>{t("Configura una propiedad paso a paso.")}</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
            <button
              className="search-button"
              aria-label={t("Buscar en CALA")}
              onClick={() => setPalette(true)}
            >
              <Icon name="search" />
              <span>{t("Buscar en CALA")}</span>
              <kbd>⌘ K</kbd>
            </button>
            <Link
              href="/admin/actividad"
              className="icon-button activity-button"
              aria-label={t("Activity Center, {count} procesos activos", {
                count: jobs,
              })}
            >
              <Icon name="notification" />
              {jobs > 0 && <span className="notification-dot" />}
            </Link>
          </div>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          {children ? (
            <div className="site-module">{children}</div>
          ) : active || section === "inicio" ? (
            <WorkspaceScreen
              key={
                section === "onboarding"
                  ? data.currentOrganizationId + ":onboarding"
                  : data.currentPropertyId + ":" + section + ":" + locale
              }
              section={section}
            />
          ) : (
            <div className="notice warning">
              {t("Tu rol no tiene acceso a este módulo.")}
            </div>
          )}
        </main>
        <footer className="workspace-footer">
          <span>CALA · {t("Hospitality, in flow.")}</span>
          <span>
            <span className="status-dot" /> {t("Cambios guardados")}
          </span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Navegación móvil">
        {items
          .filter((i) => ["inicio", "calendario", "reservas"].includes(i.path))
          .map((i) => (
            <Link
              key={i.path}
              href={"/admin/" + i.path}
              className={section === i.path ? "active" : ""}
              aria-current={section === i.path ? "page" : undefined}
            >
              <Icon name={i.icon} />
              <span>{t(i.label)}</span>
            </Link>
          ))}
        {can("property.write") && (
          <Link
            href="/admin/onboarding"
            className={`new-property-mobile ${section === "onboarding" ? "active" : ""}`}
            aria-current={section === "onboarding" ? "page" : undefined}
          >
            <span className="new-property-mobile-icon">
              <Icon name="plus" />
            </span>
            <span>{t("Nueva")}</span>
          </Link>
        )}
        <button onClick={() => setMenu(true)}>
          <Icon name="more" />
          <span>{t("Más")}</span>
        </button>
      </nav>
      {can("reservation.write") &&
        ["inicio", "calendario", "reservas"].includes(section) && (
          <Link
            className="mobile-fab"
            href="/admin/reservas?new=1"
            aria-label={t("Crear reserva")}
          >
            <Icon name="plus" />
          </Link>
        )}
      {menu && (
        <Modal title={t("Tu espacio")} onClose={() => setMenu(false)}>
          {can("property.write") && (
            <Link
              href="/admin/onboarding"
              className="mobile-new-property"
              onClick={() => setMenu(false)}
            >
              <span className="new-property-icon">
                <Icon name="plus" />
              </span>
              <span>
                <strong>{t("Nueva propiedad")}</strong>
                <small>{t("Añadir otro espacio al portafolio")}</small>
              </span>
              <Icon name="chevron-right" />
            </Link>
          )}
          <div className="mobile-nav-list">
            {regularItems.map((i) => (
              <Link
                key={i.path}
                href={"/admin/" + i.path}
                onClick={() => setMenu(false)}
              >
                <Icon name={i.icon} />
                {t(i.label)}
              </Link>
            ))}
          </div>
          <label className="field">
            <span>{t("Propiedad")}</span>
            <select
              value={data.currentPropertyId}
              onChange={(e) =>
                void select(data.currentOrganizationId, e.target.value)
              }
            >
              {data.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            onClick={async () => {
              await api("/api/session", {
                method: "POST",
                body: JSON.stringify({ action: "logout" }),
              });
              onLogout();
            }}
          >
            {t("Cerrar sesión · {role}", { role: roleLabels[role] })}
          </button>
        </Modal>
      )}
      {palette && (
        <Modal
          title={t("¿Qué necesitas hacer?")}
          onClose={() => setPalette(false)}
        >
          <label className="field">
            <span>{t("Buscar módulos o reservas")}</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Reservas, tarifas, EST…")}
            />
          </label>
          <div className="palette-results">
            {items
              .filter((i) =>
                i.label.toLowerCase().includes(query.toLowerCase()),
              )
              .map((i) => (
                <button
                  key={i.path}
                  onClick={() => {
                    navigate("/admin/" + i.path);
                    setPalette(false);
                  }}
                >
                  <Icon name={i.icon} />
                  {t(i.label)}
                  <Icon name="chevron-right" />
                </button>
              ))}
            {query &&
              data.reservations
                .filter((r) =>
                  r.confirmationCode
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .slice(0, 5)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      navigate("/admin/reservas?reservation=" + r.id);
                      setPalette(false);
                    }}
                  >
                    <Icon name="reservation" />
                    {r.confirmationCode}
                  </button>
                ))}
          </div>
        </Modal>
      )}
      {assistant && (
        <CalaAssistant
          firstName={data.currentUser.name.split(" ")[0] ?? ""}
          requiresOrganization={false}
          onComplete={() => setAssistant(false)}
          onClose={() => setAssistant(false)}
        />
      )}
      {guide && <CalaGuide section={section} onClose={() => setGuide(false)} />}
    </div>
  );
}
