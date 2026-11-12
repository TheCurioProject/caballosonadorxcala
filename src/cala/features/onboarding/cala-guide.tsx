"use client";
import { startNavigation } from "@/cala/components/ui/loading-layer";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, Modal } from "@/cala/components/ui/primitives";
import { useI18n } from "@/cala/lib/i18n";
import { guide, guideGroups } from "@/cala/domain/help/guide";

/** Searchable guide to every CALA function, opened on the current screen. */
export function CalaGuide({
  section,
  onClose,
}: {
  section: string;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const router = useRouter();
  const navigate = (href: string) => {
    startNavigation(href);
    router.push(href);
  };
  const en = locale === "en";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(
    guide.some((g) => g.path === section) ? section : "navegacion",
  );
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const topics = useMemo(() => {
    const q = normalize(query.trim());
    const list = guide.filter((g) => {
      if (!q) return true;
      const c = en ? g.en : g.es;
      return normalize(
        [c.title, c.summary, ...c.steps, c.tip ?? ""].join(" "),
      ).includes(q);
    });
    // The current screen first.
    return list.sort(
      (a, b) => Number(b.path === section) - Number(a.path === section),
    );
  }, [query, en, section]);
  const groups = [...new Set(topics.map((t) => t.group))];
  const sectionPath = (path: string) =>
    !["navegacion", "buscar", "idioma", "app"].includes(path);

  return (
    <Modal
      title={en ? "CALA function guide" : "Guía de funciones de CALA"}
      onClose={onClose}
      wide
    >
      <div className="guide" data-no-translate>
        <p className="muted guide-intro">
          {en
            ? "Everything CALA can do, in short steps. Search or tap a topic."
            : "Todo lo que puedes hacer en CALA, en pasos cortos. Busca o toca un tema."}
        </p>
        <label className="search-input guide-search">
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              en
                ? "Search: prices, team, iCal, invoice…"
                : "Busca: precios, equipo, iCal, invoice…"
            }
            aria-label={en ? "Search the guide" : "Buscar en la guía"}
          />
        </label>
        {!topics.length && (
          <p className="muted">
            {en
              ? "No topics match. Try another word."
              : "Ningún tema coincide. Prueba otra palabra."}
          </p>
        )}
        {groups.map((group) => (
          <section key={group} className="guide-group">
            <h3>{en ? guideGroups[group].en : guideGroups[group].es}</h3>
            {topics
              .filter((t) => t.group === group)
              .map((topic) => {
                const c = en ? topic.en : topic.es;
                const expanded = open === topic.path || Boolean(query.trim());
                return (
                  <article
                    key={topic.path}
                    className={
                      "guide-topic" +
                      (expanded ? " open" : "") +
                      (topic.path === section ? " current" : "")
                    }
                  >
                    <button
                      type="button"
                      className="guide-topic-head"
                      aria-expanded={expanded}
                      onClick={() =>
                        setOpen(open === topic.path ? null : topic.path)
                      }
                    >
                      <span className="guide-icon" aria-hidden="true">
                        <Icon name={topic.icon} size={18} />
                      </span>
                      <span>
                        <strong>
                          {c.title}
                          {topic.path === section && (
                            <em>{en ? "You are here" : "Estás aquí"}</em>
                          )}
                        </strong>
                        <small>{c.summary}</small>
                      </span>
                      <Icon name="chevron-down" size={16} />
                    </button>
                    {expanded && (
                      <div className="guide-topic-body">
                        <ol>
                          {c.steps.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ol>
                        {c.tip && (
                          <p className="guide-tip">
                            <Icon name="info" size={15} />
                            {c.tip}
                          </p>
                        )}
                        {sectionPath(topic.path) && topic.path !== section && (
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => {
                              onClose();
                              navigate("/admin/" + topic.path);
                            }}
                          >
                            {en ? "Open" : "Abrir"} {c.title}
                            <Icon name="chevron-right" size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
          </section>
        ))}
      </div>
    </Modal>
  );
}
