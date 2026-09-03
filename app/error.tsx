"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Growr360 client error", error);
  }, [error]);

  return <main className="growr-error-page">
    <section>
      <div><AlertTriangle /></div>
      <span>RECUPERACIÓN SEGURA</span>
      <h1>No pudimos cargar esta pantalla.</h1>
      <p>Tu información no se perdió. Probá recargar; si el problema continúa, volvé al inicio e ingresá nuevamente.</p>
      <div className="growr-error-actions">
        <button onClick={reset}><RefreshCw />Reintentar</button>
        <a href="/">Volver al inicio</a>
      </div>
      {error.digest && <small>Referencia: {error.digest}</small>}
    </section>
  </main>;
}
