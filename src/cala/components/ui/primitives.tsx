"use client";
import { useEffect, useId, useRef, useState } from "react";
import { assets, type AssetId } from "@/cala/assets/registry";
import { parseMoney, moneyInput } from "@/cala/domain/shared/money";
import { statusLabels } from "@/cala/lib/format";
import { useI18n } from "@/cala/lib/i18n";
import { CalaLoader, CalaMark } from "./cala-loader";
/** Lets CSS shrink a KPI figure to fit its tile (see device-tiers.css §5). */
export function fitChars(value: unknown): React.CSSProperties {
  return {
    ["--fit-chars" as string]: Math.max(String(value ?? "").length, 1),
  } as React.CSSProperties;
}
export function Icon({ name, size = 20 }: { name: AssetId; size?: number }) {
  if (name === "spinner")
    return (
      <span
        aria-hidden="true"
        className="icon-cala-loading"
        data-icon="spinner"
      >
        <CalaMark size={size} />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className="icon"
      data-icon={name}
      style={{
        width: size,
        height: size,
        maskImage: `url(${assets[name]})`,
        WebkitMaskImage: `url(${assets[name]})`,
      }}
    />
  );
}
export function Badge({
  status,
  children,
}: {
  status: string;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <span className={`badge badge-${status}`}>
      {children ?? t(statusLabels[status] ?? status)}
    </span>
  );
}
export function Empty({
  title = "Todo listo por aquí",
  description = "Los nuevos registros aparecerán en este espacio.",
  asset = "empty-reservations",
  children,
}: {
  title?: string;
  description?: string;
  asset?: AssetId;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="empty">
      <img src={assets[asset]} alt="" width="160" height="120" />
      <h3>{t(title)}</h3>
      <p>{t(description)}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    d?.showModal();
    // Every panel opens at its top, even if focus landed on a lower field.
    const scroller = d?.querySelector<HTMLElement>(".dialog-scroll");
    if (scroller) scroller.scrollTop = 0;
    const frame = requestAnimationFrame(() => {
      if (scroller) scroller.scrollTop = 0;
    });
    return () => {
      cancelAnimationFrame(frame);
      d?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "dialog dialog-wide" : "dialog"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="dialog-scroll">
        <div className="dialog-head">
          <div>
            <span className="eyebrow">CALA</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("Cerrar")}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export interface Field {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "number"
    | "money"
    | "date"
    | "time"
    | "select"
    | "textarea"
    | "checkbox";
  value?: string | number | boolean;
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  step?: number;
  help?: string;
  disabled?: boolean;
}
export function Form({
  fields,
  onSubmit,
  submit = "Guardar",
  onCancel,
  children,
}: {
  fields: Field[];
  onSubmit: (
    values: Record<string, string | number | boolean>,
  ) => Promise<void>;
  submit?: string;
  onCancel?: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fieldId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        const data = new FormData(e.currentTarget);
        const values: Record<string, string | number | boolean> = {};
        try {
          fields.forEach((f) => {
            values[f.name] =
              f.type === "checkbox"
                ? data.has(f.name)
                : f.type === "money"
                  ? parseMoney(String(data.get(f.name) ?? ""))
                  : f.type === "number"
                    ? Number(data.get(f.name))
                    : String(data.get(f.name) ?? f.value ?? "");
          });
          await onSubmit(values);
        } catch (e) {
          setError(e instanceof Error ? e.message : t("No se pudo guardar."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {fields.map((f) => (
          <label
            key={f.name}
            className={
              f.type === "textarea"
                ? "field field-full"
                : f.type === "checkbox"
                  ? "field checkbox"
                  : "field"
            }
          >
            <span>
              <span id={`${fieldId}-${f.name}-label`}>{f.label}</span>
              {f.required !== false && f.type !== "checkbox" && (
                <span aria-hidden="true"> *</span>
              )}
            </span>
            {f.type === "select" ? (
              <select
                aria-labelledby={`${fieldId}-${f.name}-label`}
                aria-describedby={
                  f.help ? `${fieldId}-${f.name}-help` : undefined
                }
                name={f.name}
                defaultValue={String(f.value ?? "")}
                required={f.required !== false}
                disabled={busy || f.disabled}
              >
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                aria-labelledby={`${fieldId}-${f.name}-label`}
                aria-describedby={
                  f.help ? `${fieldId}-${f.name}-help` : undefined
                }
                name={f.name}
                defaultValue={String(f.value ?? "")}
                rows={3}
                maxLength={f.maxLength ?? 2000}
                disabled={busy || f.disabled}
              />
            ) : f.type === "checkbox" ? (
              <input
                type="checkbox"
                aria-labelledby={`${fieldId}-${f.name}-label`}
                aria-describedby={
                  f.help ? `${fieldId}-${f.name}-help` : undefined
                }
                name={f.name}
                defaultChecked={Boolean(f.value)}
                disabled={busy || f.disabled}
              />
            ) : (
              <input
                aria-labelledby={`${fieldId}-${f.name}-label`}
                aria-describedby={
                  f.help ? `${fieldId}-${f.name}-help` : undefined
                }
                name={f.name}
                type={f.type === "money" ? "text" : (f.type ?? "text")}
                inputMode={f.type === "money" ? "decimal" : undefined}
                pattern={
                  f.type === "money" ? "[0-9]+([.,][0-9]{1,2})?" : undefined
                }
                defaultValue={
                  f.type === "money"
                    ? moneyInput(Number(f.value ?? 0))
                    : String(f.value ?? "")
                }
                required={f.required !== false}
                min={f.min}
                max={f.max}
                step={f.step ?? (f.type === "number" ? 1 : undefined)}
                maxLength={
                  f.type === "number" ? undefined : (f.maxLength ?? 2000)
                }
                disabled={busy || f.disabled}
              />
            )}{" "}
            {f.help && <small id={`${fieldId}-${f.name}-help`}>{f.help}</small>}
          </label>
        ))}
      </div>
      {children}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        {onCancel && (
          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {t("Cancelar")}
          </button>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? (
            <>
              <Icon name="spinner" /> {t("Guardando…")}
            </>
          ) : (
            submit
          )}
        </button>
      </div>
    </form>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="section-actions">{children}</div>
    </div>
  );
}
export function Skeleton({ label = "Cargando espacio de trabajo" }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div
      aria-busy="true"
      aria-label={t(label)}
      className="skeleton-page"
      role="status"
    >
      <div className="skeleton-veil" aria-hidden="true">
        <div className="skeleton" style={{ width: "40%", height: 48 }} />
        <div className="stats">
          {[1, 2, 3, 4].map((i) => (
            <div className="skeleton" key={i} style={{ height: 130 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 360 }} />
      </div>
      <CalaLoader className="skeleton-loader" label={label + "…"} />
    </div>
  );
}
