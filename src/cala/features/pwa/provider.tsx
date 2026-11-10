"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Icon, Modal } from "@/cala/components/ui/primitives";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface PwaState {
  installable: boolean;
  installed: boolean;
  updateAvailable: boolean;
  error: string;
  install: () => Promise<void>;
  update: () => void;
}
const PwaContext = createContext<PwaState | null>(null);
function subscribeInstalled(notify: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", notify);
  window.addEventListener("appinstalled", notify);
  return () => {
    media.removeEventListener("change", notify);
    window.removeEventListener("appinstalled", notify);
  };
}
function installedSnapshot() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}
export function PwaProvider({ children }: { children: ReactNode }) {
  const installed = useSyncExternalStore(
    subscribeInstalled,
    installedSnapshot,
    () => false,
  );
  const prompt = useRef<InstallPrompt | null>(null),
    registration = useRef<ServiceWorkerRegistration | null>(null),
    reloadRequested = useRef(false);
  const [installable, setInstallable] = useState(false),
    [updateAvailable, setUpdateAvailable] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
      setInstallable(true);
    };
    const installedEvent = () => {
      prompt.current = null;
      setInstallable(false);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installedEvent);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installedEvent);
    };
  }, []);
  useEffect(() => {
    if (window.location.pathname.startsWith("/cala/disponibilidad/")) return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    let disposed = false;
    const watched = new Set<ServiceWorker>();
    const ready = () => {
      if (!disposed && registration.current?.waiting) setUpdateAvailable(true);
    };
    const watch = () => {
      const worker = registration.current?.installing;
      if (!worker || watched.has(worker)) return;
      watched.add(worker);
      worker.addEventListener("statechange", ready);
    };
    const controller = () => {
      if (reloadRequested.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", controller);
    void navigator.serviceWorker
      .register("/admin/sw.js", { scope: "/admin/", updateViaCache: "none" })
      .then((value) => {
        if (disposed) return;
        registration.current = value;
        ready();
        value.addEventListener("updatefound", watch);
        watch();
      })
      .catch(() => {
        if (!disposed)
          setError(
            "No pudimos preparar la instalación. Puedes continuar usando CALA en el navegador.",
          );
      });
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controller,
      );
      registration.current?.removeEventListener("updatefound", watch);
      watched.forEach((worker) =>
        worker.removeEventListener("statechange", ready),
      );
    };
  }, []);
  useEffect(() => {
    const updateColor = () => {
      const color = getComputedStyle(document.body)
        .getPropertyValue("--bg")
        .trim();
      if (color)
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", color);
    };
    updateColor();
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  const install = useCallback(async () => {
    const current = prompt.current;
    if (!current) return;
    try {
      setError("");
      await current.prompt();
      await current.userChoice;
    } catch {
      setError(
        "No pudimos abrir la instalación. Usa el menú de tu navegador para añadir CALA a inicio.",
      );
    } finally {
      prompt.current = null;
      setInstallable(false);
    }
  }, []);
  const update = useCallback(() => {
    if (!registration.current?.waiting) return;
    reloadRequested.current = true;
    registration.current.waiting.postMessage({ type: "SKIP_WAITING" });
  }, []);
  return (
    <PwaContext.Provider
      value={{
        installed,
        installable,
        updateAvailable,
        error,
        install,
        update,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}
export function usePwa() {
  const value = useContext(PwaContext);
  if (!value) throw Error("PWA context missing");
  return value;
}
export function InstallControl() {
  const { installed, installable, install, error, updateAvailable, update } =
    usePwa();
  const [guide, setGuide] = useState(false),
    [updating, setUpdating] = useState(false);
  return (
    <>
      <section className="mobile-install-card">
        <Icon name="download" size={25} />
        <div>
          <strong>
            {installed ? "CALA está instalada" : "Lleva CALA en tu inicio"}
          </strong>
          <p>
            {installed
              ? "Abre tu operación directamente desde su icono."
              : "Instálala para abrirla en su propia ventana y acceder con un toque."}
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="row">
            {!installed && (
              <button
                className="button secondary"
                onClick={() => {
                  if (installable) void install();
                  else setGuide(true);
                }}
              >
                {installable ? "Instalar CALA" : "Cómo instalar"}
              </button>
            )}
            {!installed && installable && (
              <button
                className="button secondary"
                onClick={() => setGuide(true)}
              >
                Cómo instalar
              </button>
            )}
            {updateAvailable && (
              <button
                className="button secondary"
                onClick={() => setUpdating(true)}
              >
                Actualizar CALA
              </button>
            )}
          </div>
        </div>
      </section>
      {guide && (
        <Modal title="Instalar CALA" onClose={() => setGuide(false)}>
          <p>Instala CALA desde el navegador donde has iniciado sesión.</p>
          <h3>iPhone y iPad</h3>
          <ol>
            <li>Abre CALA en Safari.</li>
            <li>Toca Compartir y busca «Añadir a pantalla de inicio».</li>
            <li>
              Si aparece la opción, activa «Abrir como app web» y confirma.
            </li>
          </ol>
          <h3>Android</h3>
          <ol>
            <li>Abre CALA en Chrome o en un navegador compatible.</li>
            <li>
              Abre el menú y elige «Instalar aplicación» o «Añadir a pantalla de
              inicio».
            </li>
          </ol>
          <h3>Computadora</h3>
          <p>
            Usa el icono de instalación de Chrome/Edge o «Añadir al Dock» en
            Safari cuando esté disponible.
          </p>
          <div className="notice">
            La instalación requiere HTTPS o un entorno local compatible. Las
            opciones cambian según el navegador. CALA necesita conexión para
            confirmar reservas, cobros y otros cambios.
          </div>
          <button className="button primary" onClick={() => setGuide(false)}>
            Entendido
          </button>
        </Modal>
      )}
      {updating && (
        <Modal title="Hay una versión nueva" onClose={() => setUpdating(false)}>
          <p>
            Guarda los formularios y borradores que estés editando antes de
            actualizar. La aplicación volverá a abrirse.
          </p>
          <button className="button primary" onClick={update}>
            Actualizar y volver a abrir
          </button>
        </Modal>
      )}
    </>
  );
}
