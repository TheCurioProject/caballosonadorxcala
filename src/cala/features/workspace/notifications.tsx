"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/cala/components/ui/primitives";
import type { AssetId } from "@/cala/assets/registry";
import { useI18n } from "@/cala/lib/i18n";
import { uiLocale } from "@/cala/lib/format";

/**
 * The bell in CALA's top bar. The server already decided who gets what by
 * role (housekeeping never sees guest data, money or new bookings), so this
 * only lists, marks read and turns browser notifications on per device.
 */
type Item = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  read: boolean;
};
type State = {
  items: Item[];
  unread: number;
  devices: number;
  ready?: boolean;
  push: { configured: boolean; publicKey: string };
};
type DeviceState = "unsupported" | "ios-install" | "blocked" | "off" | "on";

const POLL_MS = 60_000;
const icons: Record<string, AssetId> = {
  "reservation.created": "reservation",
  "reservation.cancelled": "cancel-reservation",
  "checkin.completed": "check-in",
  "checkout.completed": "check-out",
  "task.assigned": "housekeeping",
  "task.created": "housekeeping",
  "task.completed": "success-circle",
  "payment.received": "payment",
  "payment.review": "warning",
  "message.received": "message",
  automation: "automation",
  test: "notification",
};

async function call<T>(method: "GET" | "POST", payload?: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/cala/notifications/", {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(typeof data.message === "string" ? data.message : "No se pudo completar.");
  return data as T;
}

function base64Key(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/admin/")) ?? null;
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function standalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function ago(iso: string) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(uiLocale(), { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
  ];
  for (const [limit, unit] of steps)
    if (Math.abs(seconds) < limit)
      return format.format(Math.round(seconds / ({ second: 1, minute: 60, hour: 3600, day: 86400 } as Record<string, number>)[unit]), unit);
  return new Intl.DateTimeFormat(uiLocale(), { day: "numeric", month: "short" }).format(new Date(iso));
}

export function NotificationBell({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<DeviceState>("off");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);

  const checkDevice = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
      setDevice(isIos() && !standalone() ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setDevice("blocked");
    const reg = await registration();
    const subscription = await reg?.pushManager.getSubscription().catch(() => null);
    setDevice(subscription && Notification.permission === "granted" ? "on" : "off");
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await call<State>("GET");
      // While this device has no push subscription, an open (background) tab still shows a system notification.
      const fresh = next.items.filter((item) => !item.read && seen.current && !seen.current.has(item.id));
      seen.current = new Set(next.items.map((item) => item.id));
      if (fresh.length && document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        const reg = await registration();
        const subscribed = await reg?.pushManager.getSubscription().catch(() => null);
        if (reg && !subscribed)
          for (const item of fresh.slice(0, 3))
            void reg.showNotification(item.title, { body: item.body, tag: item.id, icon: "/cala/pwa/icon-192.png", data: { url: item.url ?? "/admin/inicio/" } });
      }
      setState(next);
    } catch {
      /* offline or signed out: keep the last list */
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => {
      void load();
      void checkDevice();
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" || ("Notification" in window && Notification.permission === "granted")) void load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "cala-notification") void load();
      if (event.data?.type === "cala-open" && typeof event.data.url === "string") {
        const url = new URL(event.data.url);
        if (url.origin === window.location.origin && url.pathname.startsWith("/admin/")) router.push(url.pathname + url.search);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [load, checkDevice, router]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (variant === "desktop" && root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open, variant]);

  async function markRead(ids?: string[]) {
    setState((s) =>
      s && {
        ...s,
        unread: ids ? Math.max(0, s.unread - s.items.filter((i) => !i.read && ids.includes(i.id)).length) : 0,
        items: s.items.map((i) => (!ids || ids.includes(i.id) ? { ...i, read: true } : i)),
      },
    );
    await call("POST", { action: "read", ...(ids ? { ids } : {}) }).catch(() => load());
  }

  function openItem(item: Item) {
    if (!item.read) void markRead([item.id]);
    setOpen(false);
    if (item.url) router.push(item.url);
  }

  async function enable() {
    setWorking(true);
    setMessage("");
    try {
      if (!state?.push.configured || !state.push.publicKey)
        throw new Error("Las notificaciones del navegador aún no están configuradas en el servidor (faltan las claves VAPID).");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = (await registration()) ?? (await navigator.serviceWorker.ready);
      const existing = await reg.pushManager.getSubscription();
      const subscription =
        existing ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64Key(state.push.publicKey) }));
      const json = subscription.toJSON();
      await call("POST", { action: "subscribe", endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
      await call("POST", { action: "test" });
      setDevice("on");
      setMessage("Listo. Te enviamos un aviso de prueba a este dispositivo.");
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron activar las notificaciones.");
    } finally {
      setWorking(false);
    }
  }

  async function disable() {
    setWorking(true);
    setMessage("");
    try {
      const reg = await registration();
      const subscription = await reg?.pushManager.getSubscription();
      if (subscription) {
        await call("POST", { action: "unsubscribe", endpoint: subscription.endpoint }).catch(() => {});
        await subscription.unsubscribe();
      }
      setDevice("off");
    } finally {
      setWorking(false);
    }
  }

  // On phones the sheet sits above the tab bar, outside the header's stacking context.
  const sheet = (content: ReactNode) =>
    variant === "mobile" && typeof document !== "undefined" ? createPortal(content, document.body) : content;
  const unread = state?.unread ?? 0;
  const items = state?.items ?? [];
  const label = unread ? t("Notificaciones, {count} sin leer", { count: unread }) : t("Notificaciones");

  return (
    <div className={`cala-bell ${variant}`} ref={root}>
      <button
        className={variant === "mobile" ? "m-round-button cala-bell-button" : "icon-button activity-button cala-bell-button"}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value);
          void checkDevice();
          if (!open) void load();
        }}
      >
        <Icon name="notification" />
        {unread > 0 && <span className="cala-bell-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open &&
        sheet(
        <>
          {variant === "mobile" && <div className="cala-bell-backdrop" onClick={() => setOpen(false)} />}
          <section className={`cala-bell-panel ${variant}`} role="dialog" aria-label={t("Notificaciones")}>
            <header className="cala-bell-head">
              <strong>{t("Notificaciones")}</strong>
              <div className="row">
                {unread > 0 && (
                  <button className="cala-bell-link" onClick={() => void markRead()}>
                    {t("Marcar todo como leído")}
                  </button>
                )}
                {variant === "mobile" && (
                  <button className="icon-button" aria-label={t("Cerrar")} onClick={() => setOpen(false)}>
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
            </header>
            <div className={`cala-bell-device is-${device}`}>
              {device === "on" ? (
                <>
                  <span>
                    <Icon name="success-circle" size={16} /> {t("Avisos activados en este dispositivo")}
                  </span>
                  <span className="row">
                    <button className="cala-bell-link" disabled={working} onClick={() => void call("POST", { action: "test" }).then(() => setMessage("Aviso de prueba enviado."))}>
                      {t("Probar")}
                    </button>
                    <button className="cala-bell-link" disabled={working} onClick={() => void disable()}>
                      {t("Desactivar")}
                    </button>
                  </span>
                </>
              ) : device === "off" ? (
                <>
                  <span>{t("Recibe estos avisos aunque CALA esté cerrado.")}</span>
                  <button className="button primary cala-bell-enable" disabled={working} onClick={() => void enable()}>
                    {working ? t("Activando…") : t("Activar en este dispositivo")}
                  </button>
                </>
              ) : device === "blocked" ? (
                <span>{t("Las notificaciones están bloqueadas para CALA. Permítelas en los ajustes del navegador y vuelve a intentarlo.")}</span>
              ) : device === "ios-install" ? (
                <span>{t("En iPhone y iPad, añade CALA a la pantalla de inicio (Compartir → Añadir a inicio) para recibir avisos.")}</span>
              ) : (
                <span>{t("Este navegador no admite notificaciones. Los avisos siguen apareciendo aquí.")}</span>
              )}
              {message && <small role="status">{t(message)}</small>}
            </div>
            {state && state.ready === false ? (
              <p className="cala-bell-empty">{t("Las notificaciones se activarán cuando se aplique la actualización de la base de datos.")}</p>
            ) : items.length ? (
              <ul className="cala-bell-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button className={item.read ? "" : "is-unread"} onClick={() => openItem(item)}>
                      <span className="cala-bell-icon">
                        <Icon name={icons[item.kind] ?? "notification"} size={18} />
                      </span>
                      <span className="cala-bell-text">
                        <strong>{item.title}</strong>
                        {item.body && <span data-no-translate>{item.body}</span>}
                        <small>{ago(item.createdAt)}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cala-bell-empty">{t("Sin notificaciones por ahora. Aquí verás lo que tu rol necesita saber.")}</p>
            )}
            <footer className="cala-bell-foot">
              <Link href="/admin/actividad" onClick={() => setOpen(false)}>
                {t("Procesos en segundo plano")}
              </Link>
            </footer>
          </section>
        </>,
        )}
    </div>
  );
}
