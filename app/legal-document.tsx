import Link from "next/link";
import type { ReactNode } from "react";

export type LegalSection={title:string;content:ReactNode};

export function LegalPage({title,eyebrow,intro,active,sections}:{title:string;eyebrow:string;intro:string;active:"terms"|"privacy"|"faq";sections:LegalSection[]}){
 return <div className="legal-shell">
  <header className="legal-topbar"><div className="legal-topbar-inner"><Link className="legal-brand" href="/"><img src="/favicon.svg" alt="Growr360"/><strong>Growr<span>360</span></strong></Link><nav><Link className={active==="faq"?"active":""} href="/faq">Preguntas frecuentes</Link><Link className={active==="terms"?"active":""} href="/terminos">Términos</Link><Link className={active==="privacy"?"active":""} href="/privacidad">Privacidad</Link></nav><Link className="legal-brand" href="/">Volver al inicio</Link></div></header>
  <main className="legal-wrap"><aside className="legal-aside"><Link href="/">← Inicio</Link><div className="legal-aside-card"><strong>Información clara</strong><p>Documentación vigente para usar Growr360 y entender cómo protegemos tu información.</p><a href="mailto:info@growr.com">info@growr.com</a></div></aside><article className="legal-document"><header><small>{eyebrow}</small><h1>{title}</h1><p>{intro}</p></header>{active==="faq"?<div className="faq-list">{sections.map((section,index)=><details key={section.title} open={index===0}><summary>{section.title}</summary><div>{section.content}</div></details>)}</div>:sections.map((section,index)=><section className="legal-section-card" id={`seccion-${index+1}`} key={section.title}><h2>{index+1}. {section.title}</h2>{section.content}</section>)}</article></main>
  <footer className="legal-footer"><div><span>© 2026 Growr360 · Buenos Aires, Argentina</span><span>Responsable: JM Iglesias · <a href="mailto:info@growr.com">info@growr.com</a></span></div></footer>
 </div>
}
