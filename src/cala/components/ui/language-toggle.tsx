"use client";
import { Icon } from "@/cala/components/ui/primitives";
import { useI18n, type Locale } from "@/cala/lib/i18n";

const LANGS: { code: Locale; name: string }[] = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
];

/**
 * Language switch.
 * - Top bar (desktop/tablet): segmented control with a sliding thumb, same
 *   look as CALA's other segmented controls.
 * - Phone header (`compact`): round icon button with the active language as
 *   a badge; one tap switches.
 */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const next: Locale = locale === "es" ? "en" : "es";
  const label =
    locale === "es" ? "Cambiar idioma a inglés" : "Switch language to Spanish";
  if (compact)
    return (
      <button
        type="button"
        className="m-round-button language-toggle-compact"
        aria-label={label}
        title={label}
        data-no-translate
        onClick={() => setLocale(next)}
      >
        <Icon name="language" size={21} />
        <span className="language-toggle-badge" key={locale}>
          {locale.toUpperCase()}
        </span>
      </button>
    );
  return (
    <div
      className="language-toggle"
      role="radiogroup"
      aria-label={locale === "es" ? "Idioma" : "Language"}
      data-locale={locale}
      data-no-translate
    >
      <span className="language-toggle-icon" aria-hidden="true">
        <Icon name="language" size={16} />
      </span>
      <span className="language-toggle-track">
        <span className="language-toggle-thumb" aria-hidden="true" />
        {LANGS.map(({ code, name }) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={locale === code}
            aria-label={name}
            className={locale === code ? "active" : ""}
            onClick={() => locale !== code && setLocale(code)}
            title={name}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </span>
    </div>
  );
}
