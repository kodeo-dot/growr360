"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Growr360 fatal client error", error); }, [error]);
  return <html lang="es"><body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#eef8f1", color: "#123d31" }}><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}><section style={{ maxWidth: 520, padding: 36, borderRadius: 24, background: "#fff", boxShadow: "0 20px 55px #1748351f" }}><p style={{ margin: 0, color: "#08784d", fontWeight: 800, fontSize: 12 }}>GROWR360</p><h1 style={{ margin: "12px 0", fontSize: 34 }}>No pudimos abrir esta pantalla.</h1><p style={{ color: "#526e63", lineHeight: 1.55 }}>Tu información sigue resguardada. Intentá nuevamente o volvé al inicio.</p><div style={{ display: "flex", gap: 10, marginTop: 24 }}><button onClick={reset} style={{ border: 0, borderRadius: 10, padding: "13px 16px", background: "#08784d", color: "white", fontWeight: 800 }}>Reintentar</button><a href="/" style={{ border: "1px solid #bdd4c6", borderRadius: 10, padding: "12px 16px", color: "#174c3c", textDecoration: "none", fontWeight: 800 }}>Volver al inicio</a></div></section></main></body></html>;
}
