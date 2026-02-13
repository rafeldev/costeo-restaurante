"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);
    if (result?.error) {
      setError("Credenciales invalidas");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-slate-100 to-transparent"
      />

      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10 sm:px-6">
        <section className="surface-card w-full p-6 sm:p-8">
          <div className="mb-6">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium tracking-wide text-slate-600">
              CALCULACHEF
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Bienvenido de nuevo
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Accede con las credenciales creadas por el administrador para continuar con tus
              costos, recetas e inventario.
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">Correo</span>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="usuario@negocio.com"
                required
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">Contrasena</span>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Ingresa tu contrasena"
                required
              />
            </label>

            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn-primary mt-1 inline-flex w-full items-center justify-center"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Entrar al sistema"}
            </button>
          </form>

          <p className="mt-5 text-xs text-slate-500">
            Si no tienes acceso, solicita tus credenciales al administrador del sistema.
          </p>
        </section>
      </div>
    </main>
  );
}
