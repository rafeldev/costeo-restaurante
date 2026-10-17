"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="es"><body><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif", padding: 24, textAlign: "center" }}><div><h1>No pudimos iniciar CalculaChef</h1><p>Intenta nuevamente. Si el problema continúa, contacta al soporte del piloto.</p><button onClick={reset} style={{ padding: "12px 18px", marginTop: 16 }}>Intentar de nuevo</button></div></main></body></html>;
}
