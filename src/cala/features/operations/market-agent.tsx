"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/cala/features/workspace/context";
import { Icon } from "@/cala/components/ui/primitives";
import { useI18n } from "@/cala/lib/i18n";
import { money } from "@/cala/lib/format";
import {
  runAdvisor,
  type AdvisorReport,
  type Recommendation,
} from "@/cala/domain/analytics/advisor";

const priorityLabel = {
  1: "Actúa ahora",
  2: "Esta semana",
  3: "Cuando puedas",
} as const;

/** Market agent: investigate → analyze → recommend, shown step by step. */
export function MarketAgent() {
  const { data } = useWorkspace();
  const { t, locale } = useI18n();
  const property = data.properties.find((p) => p.id === data.currentPropertyId);
  const [report, setReport] = useState<AdvisorReport | null>(null);
  const [pending, setPending] = useState<AdvisorReport | null>(null);
  const [step, setStep] = useState(-1);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function analyze() {
    timers.current.forEach(clearTimeout);
    const next = runAdvisor(data, (minor) =>
      money(minor, property?.currency ?? "MXN"),
    );
    setReport(null);
    setPending(next);
    setStep(0);
    // Reveal each investigation step so the reasoning is visible.
    next.steps.forEach((_, i) =>
      timers.current.push(
        window.setTimeout(() => setStep(i + 1), 450 * (i + 1)),
      ),
    );
    timers.current.push(
      window.setTimeout(
        () => {
          setReport(next);
          setStep(next.steps.length);
        },
        450 * (next.steps.length + 1),
      ),
    );
  }
  const running = step >= 0 && !report;
  const preview = pending?.steps ?? [];

  return (
    <section className="panel agent-panel" aria-live="polite">
      <div className="agent-head">
        <span className="agent-mark" aria-hidden="true">
          <Icon name="reports" size={22} />
        </span>
        <div>
          <span className="eyebrow">{t("AGENTE DE MERCADO")}</span>
          <h2>{t("Tu analista de reservas")}</h2>
          <p className="muted">
            {t(
              "Investiga tu nicho y tu competencia, estudia el historial de CALA y te dice qué hacer para vender más. Usa reglas y un banco de conocimiento, no inventa datos.",
            )}
          </p>
        </div>
        <button
          className="button primary"
          onClick={analyze}
          disabled={running}
        >
          <Icon name={running ? "spinner" : "sync"} />
          {running
            ? t("Analizando…")
            : report
              ? t("Volver a analizar")
              : t("Analizar ahora")}
        </button>
      </div>

      {step >= 0 && (
        <ol className="agent-steps">
          {preview.map((s, i) => (
            <li
              key={s.label}
              className={i < step ? "done" : i === step ? "current" : ""}
            >
              <span className="agent-step-dot" aria-hidden="true">
                {i < step ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <div>
                <strong>{t(s.label)}</strong>
                {i < step && <small>{t(s.detail, s.values)}</small>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {report && (
        <>
          <div className="agent-metrics">
            {report.metrics.map((m) => (
              <div key={m.label}>
                <small>{t(m.label)}</small>
                <strong>
                  {m.value}
                  {m.hint && <span> {t(m.hint)}</span>}
                </strong>
              </div>
            ))}
          </div>
          <h3 className="agent-subtitle">
            {t("Recomendaciones")} · {report.recommendations.length}
          </h3>
          {report.recommendations.length ? (
            <div className="agent-recs">
              {report.recommendations.map((r) => (
                <RecommendationCard key={r.id} rec={r} />
              ))}
            </div>
          ) : (
            <p className="muted">
              {t(
                "Todo en orden: no hay acciones urgentes con los datos actuales.",
              )}
            </p>
          )}
          <details className="agent-niche">
            <summary>
              {t("Nicho: {niche}", { niche: t(report.niche.label) })}
            </summary>
            <p className="muted">{t(report.niche.guests)}</p>
            <strong>{t("Palancas que suelen funcionar en tu nicho")}</strong>
            <ul>
              {report.niche.levers.map((l) => (
                <li key={l}>{t(l)}</li>
              ))}
            </ul>
          </details>
          <p className="agent-foot muted">
            {t("Análisis de {time}", {
              time: new Intl.DateTimeFormat(
                locale === "en" ? "en-US" : "es-MX",
                { dateStyle: "medium", timeStyle: "short" },
              ).format(new Date(report.generatedAt)),
            })}{" "}
            ·{" "}
            {t(
              "Las recomendaciones no cambian tarifas por sí solas: tú decides y aplicas desde CALA.",
            )}
          </p>
        </>
      )}
    </section>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const { t } = useI18n();
  return (
    <article className={`agent-rec priority-${rec.priority}`}>
      <header>
        <span className={`agent-badge priority-${rec.priority}`}>
          {t(priorityLabel[rec.priority])}
        </span>
        <small className="muted">
          {t("Confianza {level}", { level: t(rec.confidence) })}
        </small>
      </header>
      <h4>{t(rec.title, rec.values)}</h4>
      <p>
        <b>{t("Por qué")}:</b> {t(rec.why, rec.values)}
      </p>
      <p>
        <b>{t("Qué hacer")}:</b> {t(rec.action, rec.values)}
      </p>
      {rec.evidence.length > 0 && (
        <ul className="agent-evidence">
          {rec.evidence.map((e) => (
            <li key={e.label}>
              <small>{t(e.label)}</small>
              <strong>{e.value}</strong>
            </li>
          ))}
        </ul>
      )}
      {rec.href && (
        <Link className="button secondary agent-cta" href={rec.href}>
          {t(rec.cta ?? "Abrir")}
          <Icon name="chevron-right" size={16} />
        </Link>
      )}
    </article>
  );
}
