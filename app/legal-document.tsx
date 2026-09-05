"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

export type LegalSection = { title: string; content: ReactNode };

const NAV_ITEMS: { key: "faq" | "terms" | "privacy"; href: string; label: string }[] = [
  { key: "faq", href: "/faq", label: "Preguntas frecuentes" },
  { key: "terms", href: "/terminos", label: "Términos" },
  { key: "privacy", href: "/privacidad", label: "Privacidad" },
];

export function LegalPage({ title, eyebrow, intro, active, sections }: { title: string; eyebrow: string; intro: string; active: "terms" | "privacy" | "faq"; sections: LegalSection[] }) {
  const isFaq = active === "faq";
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!isFaq || !query.trim()) return sections;
    const q = query.trim().toLowerCase();
    return sections.filter(s => s.title.toLowerCase().includes(q));
  }, [sections, query, isFaq]);

  return (
    <div className="legal-shell">
      <header className="legal-topbar">
        <div className="legal-topbar-inner">
          <Link className="legal-brand" href="/">
            <img src="/favicon.svg" alt="Growr360" />
            <strong>Growr<span>360</span></strong>
          </Link>
          <nav>
            {NAV_ITEMS.map(item => (
              <Link key={item.key} className={active === item.key ? "active" : ""} href={item.href}>{item.label}</Link>
            ))}
          </nav>
          <Link className="legal-home-btn" href="/">Volver al inicio</Link>
        </div>
      </header>

      <main className="legal-wrap">
        <aside className="legal-aside">
          <Link href="/" className="legal-aside-back">← Volver al inicio</Link>

          {!isFaq && sections.length > 0 && (
            <nav className="legal-toc" aria-label="Contenido del documento">
              <strong>En este documento</strong>
              {sections.map((s, i) => <a key={s.title} href={`#seccion-${i + 1}`}>{i + 1}. {s.title}</a>)}
            </nav>
          )}

          <div className="legal-aside-card">
            <strong>{isFaq ? "¿No encontraste tu respuesta?" : "¿Tenés dudas?"}</strong>
            <p>Escribinos y te ayudamos directamente.</p>
            <a href="mailto:info@growr.com">info@growr.com</a>
            <a href="tel:+5492346458558">+54 9 2346 458558</a>
          </div>

          <div className="legal-aside-links">
            {NAV_ITEMS.filter(item => item.key !== active).map(item => (
              <Link key={item.key} href={item.href}>{item.label}</Link>
            ))}
          </div>
        </aside>

        <article className="legal-document">
          <header>
            <small>{eyebrow}</small>
            <h1>{title}</h1>
            <p>{intro}</p>
          </header>

          {isFaq ? (
            <>
              <div className="legal-search">
                <input
                  type="text"
                  inputMode="search"
                  placeholder="Buscar una pregunta…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  aria-label="Buscar en preguntas frecuentes"
                />
              </div>
              {filteredSections.length === 0 ? (
                <p className="legal-empty">No encontramos preguntas que coincidan con &ldquo;{query}&rdquo;. Probá con otra palabra o escribinos directamente.</p>
              ) : (
                <div className="faq-list">
                  {filteredSections.map((section, index) => (
                    <details key={section.title} open={index === 0 && !query.trim()}>
                      <summary>{section.title}</summary>
                      <div>{section.content}</div>
                    </details>
                  ))}
                </div>
              )}
            </>
          ) : (
            sections.map((section, index) => (
              <section className="legal-section-card" id={`seccion-${index + 1}`} key={section.title}>
                <h2>{index + 1}. {section.title}</h2>
                {section.content}
              </section>
            ))
          )}
        </article>
      </main>

      <footer className="legal-footer">
        <div>
          <span>© 2026 Growr360 · Buenos Aires, Argentina</span>
          <span>Responsable: JM Iglesias · <a href="mailto:info@growr.com">info@growr.com</a></span>
        </div>
      </footer>
    </div>
  );
}
