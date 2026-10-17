import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center"><h1 className="text-2xl font-bold text-primary">Página no encontrada</h1><p className="mt-2 text-sm text-muted">El recurso solicitado no existe o ya no está disponible.</p><Link className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-white" href="/">Volver al inicio</Link></main>;
}
