"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { CalaLogo } from "@/cala/components/brand/cala-logo";
import { Icon } from "@/cala/components/ui/primitives";
import { api } from "@/cala/features/workspace/context";
import { useI18n } from "@/cala/lib/i18n";

const steps = [
  {
    eyebrow: "1 · TU ESPACIO",
    title: "Bienvenido a una forma más tranquila de operar.",
    copy: "Inicio reúne el estado del día y te muestra lo importante en el momento correcto, sin perder de vista la hospitalidad.",
    icon: "home",
    previewTitle: "Inicio",
    previewItems: [
      "Estado del día",
      "Llegadas y salidas",
      "Alertas operativas",
    ],
  },
  {
    eyebrow: "2 · NAVEGACIÓN",
    title: "Muévete por la operación sin perder contexto.",
    copy: "La navegación agrupa calendario, reservas, inventario y operación. Los datos de cada huésped viven dentro de su reserva. En móvil, las acciones principales permanecen siempre a la mano.",
    icon: "calendar",
    previewTitle: "Operación",
    previewItems: ["Calendario", "Reservas", "Inventario y tareas"],
  },
  {
    eyebrow: "3 · BÚSQUEDA Y ACTIVIDAD",
    title: "Encuentra y atiende lo importante más rápido.",
    copy: "Usa la búsqueda global para saltar a cualquier área, consulta el Activity Center para seguir procesos y abre la Guía de funciones del Asistente CALA cuando tengas dudas.",
    icon: "search",
    previewTitle: "Accesos rápidos",
    previewItems: ["Buscar en CALA", "Activity Center", "Asistente CALA"],
  },
  {
    eyebrow: "4 · AJUSTES",
    title: "Adapta CALA a tu equipo y forma de trabajar.",
    copy: "Cambia el idioma con ES/EN en la barra superior. Desde Configuración eliges tema, densidad y tamaño de texto; en Equipo y permisos gestionas a tu equipo.",
    icon: "settings",
    previewTitle: "Ajustes y equipo",
    previewItems: [
      "Idioma y tamaño de texto",
      "Equipo y permisos",
      "Guía de funciones",
    ],
  },
  {
    eyebrow: "5 · SIGUIENTE PASO",
    title: "Prepara el hogar de tu operación.",
    copy: "Al continuar abrirás Primeros pasos: un recorrido guardado para configurar tu propiedad, inventario, horarios y tarifa inicial.",
    icon: "property",
    previewTitle: "Primeros pasos",
    previewItems: [
      "Datos de la propiedad",
      "Inventario y horarios",
      "Tarifa inicial",
    ],
  },
] as const;

export function CalaAssistant({
  firstName,
  requiresOrganization,
  onComplete,
  onClose,
}: {
  firstName: string;
  requiresOrganization: boolean;
  onComplete: () => void | Promise<void>;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [organizationName, setOrganizationName] = useState(
    firstName ? `${firstName} Hospitality` : "Mi organización",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function finish(skipped = false) {
    setBusy(true);
    setError("");
    try {
      if (requiresOrganization) {
        const name = organizationName.trim() || `${firstName} Hospitality`;
        await api("/api/commands", {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({ type: "organization.create", name }),
        });
      }
      await api("/api/session", {
        method: "POST",
        body: JSON.stringify({ action: "assistant_complete" }),
      });
      await onComplete();
      if (skipped) onClose?.();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("No pudimos preparar tu espacio."),
      );
    } finally {
      setBusy(false);
    }
  }

  const content = steps[step];
  return (
    <div
      className="assistant-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-title"
    >
      <motion.div className="assistant-shell" initial={false}>
        <header className="assistant-head">
          <CalaLogo />
          <button
            className="assistant-skip"
            disabled={busy}
            onClick={() => void finish(true)}
          >
            {t("Omitir tutorial")}
          </button>
        </header>
        <div className="assistant-body">
          <div className="assistant-visual">
            <div className="assistant-cala-shape" aria-hidden="true" />
            <motion.div
              key={step}
              className="assistant-tour-preview"
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
            >
              <span className="assistant-tour-icon" aria-hidden="true">
                <Icon name={content.icon} size={31} />
              </span>
              <small>{t("VISTA GUIADA")}</small>
              <strong>{t(content.previewTitle)}</strong>
              <div className="assistant-tour-list">
                {content.previewItems.map((item) => (
                  <span key={item}>
                    <Icon name="check" size={14} /> {t(item)}
                  </span>
                ))}
              </div>
            </motion.div>
            <div className="assistant-quote">
              <span className="status-dot" />
              {step === 0
                ? t("Qué gusto recibirte, {name}.", {
                    name: firstName || t("anfitrión"),
                  })
                : step === steps.length - 1
                  ? t("Listo para configurar tu propiedad.")
                  : t("Vamos a tu ritmo.")}
            </div>
          </div>
          <div className="assistant-content">
            <div
              className="assistant-progress"
              aria-label={t("Paso {step} de {total}", {
                step: step + 1,
                total: steps.length,
              })}
              aria-valuemax={steps.length}
              aria-valuemin={1}
              aria-valuenow={step + 1}
              role="progressbar"
            >
              {steps.map((_, index) => (
                <span key={index} className={index <= step ? "active" : ""} />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={reduceMotion ? false : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
                transition={{ duration: 0.26 }}
              >
                <p className="eyebrow">{t(content.eyebrow)}</p>
                <h1 id="assistant-title">{t(content.title)}</h1>
                <p className="assistant-copy">{t(content.copy)}</p>
                {step === 3 && (
                  <div className="assistant-note">
                    <Icon name="theme" />{" "}
                    {t(
                      "Puedes volver a este tutorial cuando quieras desde Asistente CALA.",
                    )}
                  </div>
                )}
                {step === steps.length - 1 && requiresOrganization && (
                  <label className="field assistant-organization">
                    <span>{t("Nombre de tu organización")}</span>
                    <input
                      value={organizationName}
                      onChange={(event) =>
                        setOrganizationName(event.target.value)
                      }
                      maxLength={160}
                      autoFocus
                    />
                    <small>
                      {t("Podrás cambiarlo después desde Configuración.")}
                    </small>
                  </label>
                )}
                {step === steps.length - 1 && !requiresOrganization && (
                  <div className="assistant-next-card">
                    <Icon name="property" size={26} />
                    <div>
                      <strong>{t("Configura tu primera propiedad")}</strong>
                      <span>
                        {t("Concepto, inventario, horarios y tarifa inicial.")}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <footer className="assistant-actions">
              <button
                className="button secondary"
                disabled={busy || step === 0}
                onClick={() => setStep((value) => Math.max(0, value - 1))}
              >
                {t("Atrás")}
              </button>
              <button
                className="button primary"
                disabled={
                  busy ||
                  (step === steps.length - 1 &&
                    requiresOrganization &&
                    !organizationName.trim())
                }
                onClick={() => {
                  if (step === steps.length - 1) void finish();
                  else setStep((value) => value + 1);
                }}
              >
                {busy ? t("Preparando CALA…") : t("Continuar")}
                {!busy && <Icon name="chevron-right" size={16} />}
              </button>
            </footer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
