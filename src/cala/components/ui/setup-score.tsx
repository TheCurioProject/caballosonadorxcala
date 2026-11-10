"use client";
import Link from "next/link";
import { useWorkspace } from "@/cala/features/workspace/context";
import { setupChecklist, setupScore } from "@/cala/domain/onboarding/score";
import { Icon } from "./primitives";
import { useI18n } from "@/cala/lib/i18n";
export function SetupScore() {
  const { data } = useWorkspace();
  const { t } = useI18n();
  const score = setupScore(data, data.currentPropertyId);
  return (
    <details className="panel padded" style={{ marginBottom: 24 }}>
      <summary
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Icon name="setup-complete" size={24} />
        <strong style={{ fontSize: 13 }}>
          {t("Tu propiedad, cada vez más completa")}
        </strong>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>{score}%</span>
      </summary>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: score + "%" }} />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        {t(
          "Los servicios de producción pendientes no impiden probar la operación local.",
        )}
      </p>
      <div className="card-grid">
        {setupChecklist(data, data.currentPropertyId).map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="row"
            style={{ fontSize: 12 }}
          >
            <Icon name={item.complete ? "check" : "info"} size={16} />
            {t(item.label)} · {item.weight}%
          </Link>
        ))}
      </div>
    </details>
  );
}
