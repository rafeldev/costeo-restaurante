"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center"><h1 className="text-2xl font-bold text-primary">No pudimos cargar esta sección</h1><p className="mt-2 text-sm text-muted">El incidente fue registrado. Puedes intentar nuevamente sin perder los datos ya guardados.</p><button className="mt-5 h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white" onClick={reset}>Intentar de nuevo</button></main>;
}
