"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Snapshot, CommandResult, Permission } from "@/cala/domain/model";
import { browserPreferences } from "@/cala/lib/browser-preferences";
import { today } from "@/cala/domain/shared/dates";
import { beginActivity, type ActivityKind } from "@/cala/lib/activity";
export type SyncStatus = "synced" | "refreshing" | "offline" | "error";
interface Workspace {
  data: Snapshot;
  refresh: () => Promise<void>;
  command: (input: Record<string, unknown>) => Promise<CommandResult>;
  select: (organizationId: string, propertyId?: string) => Promise<void>;
  notify: (message: string, kind?: "success" | "warning" | "error") => void;
  can: (permission: Permission) => boolean;
  busy: boolean;
  syncStatus: SyncStatus;
  lastRefreshedAt: number;
  syncError: string;
}
export const WorkspaceContext = createContext<Workspace | null>(null);
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw Error("Workspace context missing");
  return ctx;
}
/** Organization-overview dialogs keep their property's command and date scope. */
export function PropertyWorkspace({
  propertyId,
  children,
}: {
  propertyId: string;
  children: ReactNode;
}) {
  const workspace = useWorkspace();
  const property = workspace.data.properties.find((p) => p.id === propertyId);
  if (!property)
    return (
      <p className="notice error" role="alert">
        Ya no tienes acceso a esta propiedad. Actualiza la vista.
      </p>
    );
  return (
    <WorkspaceContext.Provider
      value={{
        ...workspace,
        data: {
          ...workspace.data,
          currentPropertyId: property.id,
          today: today(property.timezone),
        },
        command: (input) =>
          workspace.command({ ...input, propertyId: property.id }),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
/**
 * Calls the CALA API. Writes always register as pending work (loader + busy
 * button); reads only when `activity` is given, so background polling stays
 * silent. Pass `activity: false` to opt a write out.
 */
export async function api<T>(
  url: string,
  options?: RequestInit,
  activity?: { kind?: ActivityKind; label?: string } | false,
): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  const end =
    activity === false || (!activity && method === "GET")
      ? null
      : beginActivity(
          activity?.kind ?? (method === "GET" ? "load" : "save"),
          activity?.label ?? (method === "GET" ? undefined : "Procesando…"),
        );
  try {
    return await request<T>(url, options);
  } finally {
    end?.();
  }
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url.replace(/^\/api\//, "/api/cala/"), {
    ...options,
    cache: "no-store",
    signal:
      options?.signal ??
      (typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(25000)
        : undefined),
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const result = await response.json();
  if (!response.ok) {
    const details = result.field_errors
      ?.map(
        (e: { field: string; message: string }) => `${e.field}: ${e.message}`,
      )
      .join(" · ");
    throw Object.assign(
      new Error(
        details || result.message || "No pudimos completar la operación.",
      ),
      { status: response.status, code: result.code },
    );
  }
  return result as T;
}
export function WorkspaceProvider({
  initial,
  children,
  onSessionExpired,
}: {
  initial: Snapshot;
  children: ReactNode;
  onSessionExpired: () => void;
}) {
  const pending = useRef(new Map<string, string>()),
    operations = useRef(0);
  const scope = useRef({
    organizationId: initial.currentOrganizationId,
    propertyId: initial.currentPropertyId,
    epoch: 0,
    selecting: false,
  });
  const reading = useRef<{ epoch: number; promise: Promise<void> } | null>(
    null,
  );
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced"),
    [syncError, setSyncError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => Date.now());
  const [toast, setToast] = useState<{ message: string; kind: string } | null>(
    null,
  );
  const notify = useCallback(
    (message: string, kind = "success") => setToast({ message, kind }),
    [],
  );
  const refresh = useCallback(async () => {
    const current = { ...scope.current };
    if (current.selecting) return;
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return;
    }
    if (reading.current?.epoch === current.epoch)
      return reading.current.promise;
    const active = () =>
      scope.current.epoch === current.epoch && !scope.current.selecting;
    const work = (async () => {
      if (active()) setSyncStatus("refreshing");
      try {
        const next = await api<Snapshot>(
          `/api/workspace?organizationId=${encodeURIComponent(current.organizationId)}&propertyId=${encodeURIComponent(current.propertyId)}`,
        );
        if (!active()) return;
        setData(next);
        setSyncStatus("synced");
        setSyncError("");
        setLastRefreshedAt(Date.now());
      } catch (e) {
        if (!active()) return;
        if ((e as { status?: number }).status === 401) onSessionExpired();
        else {
          setSyncStatus(navigator.onLine ? "error" : "offline");
          setSyncError(
            "No pudimos actualizar los datos. Comprueba tu conexión y vuelve a intentar.",
          );
          throw e;
        }
      }
    })();
    reading.current = { epoch: current.epoch, promise: work };
    try {
      await work;
    } finally {
      if (reading.current?.promise === work) reading.current = null;
    }
  }, [onSessionExpired]);
  useEffect(() => {
    if (!toast || toast.kind === "error") return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => {});
    };
    const offline = () => setSyncStatus("offline");
    const timer = setInterval(poll, 3000);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("online", poll);
    window.addEventListener("pageshow", poll);
    window.addEventListener("offline", offline);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("online", poll);
      window.removeEventListener("pageshow", poll);
      window.removeEventListener("offline", offline);
    };
  }, [refresh]);
  function begin() {
    operations.current++;
    setBusy(true);
  }
  function finish() {
    operations.current--;
    setBusy(operations.current > 0);
  }
  async function command(input: Record<string, unknown>) {
    if (!navigator.onLine) {
      const message =
        "Sin conexión. Vuelve a conectarte antes de guardar; este cambio no se ha enviado.";
      notify(message, "error");
      throw Error(message);
    }
    begin();
    // Covers the write and the view refresh that follows it.
    const endActivity = beginActivity("save", "Guardando cambios…");
    const body = JSON.stringify({
      organizationId: scope.current.organizationId,
      propertyId: scope.current.propertyId,
      ...input,
    });
    const key = pending.current.get(body) ?? crypto.randomUUID();
    pending.current.set(body, key);
    try {
      const result = await api<CommandResult>(
        "/api/commands",
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body,
        },
        false,
      );
      pending.current.delete(body);
      // Invalidate reads started before this commit without waiting for a slow response.
      // A property selection owns its ticket until it finishes.
      if (!scope.current.selecting) scope.current.epoch++;
      try {
        await refresh();
      } catch {
        notify(
          "Cambios guardados. No pudimos actualizar la vista; recarga para verlos.",
          "warning",
        );
        return result;
      }
      notify(
        result.warning ?? result.message,
        result.warning ? "warning" : "success",
      );
      return result;
    } catch (e) {
      if (
        (e as { status?: number }).status &&
        (e as { status: number }).status < 500
      )
        pending.current.delete(body);
      const message = e instanceof Error ? e.message : "No se pudo guardar.";
      notify(message, "error");
      throw e;
    } finally {
      endActivity();
      finish();
    }
  }
  async function select(organizationId: string, propertyId?: string) {
    if (!navigator.onLine) {
      notify(
        "Conéctate para cambiar de propiedad y cargar sus datos actuales.",
        "error",
      );
      return;
    }
    begin();
    const ticket = ++scope.current.epoch;
    scope.current.selecting = true;
    try {
      const next = await api<Snapshot>(
        `/api/workspace?organizationId=${encodeURIComponent(organizationId)}${propertyId ? "&propertyId=" + encodeURIComponent(propertyId) : ""}`,
        undefined,
        { kind: "load", label: "Cambiando de propiedad…" },
      );
      if (scope.current.epoch !== ticket) return;
      scope.current = {
        organizationId: next.currentOrganizationId,
        propertyId: next.currentPropertyId,
        epoch: ticket,
        selecting: false,
      };
      setData(next);
      setSyncStatus("synced");
      setSyncError("");
      setLastRefreshedAt(Date.now());
      browserPreferences.setItem(
        "cala-scope",
        JSON.stringify({
          organizationId: next.currentOrganizationId,
          propertyId: next.currentPropertyId,
        }),
      );
    } catch (e) {
      if (scope.current.epoch === ticket)
        notify(
          e instanceof Error ? e.message : "No se pudo cambiar de propiedad.",
          "error",
        );
    } finally {
      if (scope.current.epoch === ticket) scope.current.selecting = false;
      finish();
    }
  }
  return (
    <WorkspaceContext.Provider
      value={{
        data,
        refresh,
        command,
        select,
        notify,
        can: (p) => data.permissions.includes(p),
        busy,
        syncStatus,
        syncError,
        lastRefreshedAt,
      }}
    >
      {children}
      {toast && (
        <div
          className={`toast ${toast.kind}`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
