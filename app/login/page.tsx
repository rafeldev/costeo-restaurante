"use client";

import { FormEvent, Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

function LoginForm() {
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
      setError("Credenciales inválidas. Verifica tu correo y contraseña.");
      toast.error("No fue posible iniciar sesión", {
        description: "Verifica tu correo y contraseña.",
      });
      return;
    }

    toast.success("Sesión iniciada");
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--parchment)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[var(--border-subtle)] to-transparent"
      />

      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10 sm:px-6">
        <section className="surface-card w-full p-6 sm:p-8">
          <div className="mb-6">
            <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--parchment)] px-3 py-1 text-xs font-medium tracking-wide text-secondary">
              CALCULACHEF
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Bienvenido de nuevo
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Accede con las credenciales creadas por el administrador para continuar con tus
              costos, recetas e inventario.
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="block text-sm">
              <label htmlFor="login-email" className="mb-1.5 block font-medium text-primary">
                Correo
              </label>
              <input
                id="login-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="usuario@negocio.com"
                required
                aria-describedby={error ? "login-error" : undefined}
                aria-invalid={!!error}
              />
            </div>

            <div className="block text-sm">
              <label htmlFor="login-password" className="mb-1.5 block font-medium text-primary">
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                required
                aria-describedby={error ? "login-error" : undefined}
                aria-invalid={!!error}
              />
            </div>

            {error ? (
              <p
                id="login-error"
                className="rounded-lg border border-[var(--border-strong)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]"
                role="alert"
                aria-live="polite"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="default"
              disabled={loading}
              className="mt-1 w-full"
            >
              {loading ? "Ingresando…" : "Entrar al sistema"}
            </Button>
          </form>

          <p className="mt-5 text-xs text-muted">
            Si no tienes acceso, solicita tus credenciales al administrador del sistema.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--parchment)]" />}>
      <LoginForm />
    </Suspense>
  );
}
