"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

function getSafeCallbackUrl(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(
    searchParams.get("next") ?? searchParams.get("callbackUrl"),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

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
    } catch {
      setError("No pudimos conectar con el sistema. Intenta nuevamente.");
      toast.error("No fue posible iniciar sesión", {
        description: "Revisa tu conexión e intenta nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  function showAccessHelp() {
    toast.info("Solicita acceso al administrador de tu restaurante.");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--parchment)] selection:bg-[var(--warning-surface)] selection:text-[var(--warning-text)]">
      <header className="flex w-full items-center justify-between gap-4 px-4 py-4 text-xs text-secondary sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-2">
          {/* <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--success-text)] motion-reduce:animate-none" aria-hidden />
          <span className="truncate font-medium tracking-wide">Plataforma Operativa v2.4 Activa</span> */}
        </div>
        <nav className="flex shrink-0 items-center gap-3 sm:gap-4" aria-label="Ayuda de acceso">
          <a href="#login-help" className="inline-flex min-h-11 items-center gap-1.5 font-medium transition-colors hover:text-primary hover:underline">
            <span className="material-symbols-outlined text-[16px] text-[var(--accent)]" aria-hidden>help</span>
            <span className="hidden sm:inline">Guía de Acceso Operativo</span>
            <span className="sm:hidden">Ayuda</span>
          </a>
          <span className="hidden text-muted sm:inline" aria-hidden>|</span>
          <a href="#login-help" className="hidden min-h-11 items-center font-medium transition-colors hover:text-primary hover:underline sm:inline-flex">
            Soporte Sous-Chef
          </a>
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <section className="w-full max-w-md overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_40px_-15px_rgba(15,23,42,0.12)]" aria-labelledby="login-title">
          <div className="h-1.5 w-full bg-gradient-to-r from-[var(--accent)] via-[#d97706] to-[var(--ink)]" aria-hidden />

          <div className="p-6 sm:p-9">
            <div className="mb-7">
              {/* <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--control-bg)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
                <span className="material-symbols-outlined text-[15px] text-[var(--accent)]" aria-hidden>restaurant</span>
                CalculaChef · Plataforma de costeo
              </span> */}
              <h1 id="login-title" className=" text-2xl font-bold tracking-[-0.025em] text-primary sm:text-[26px]">
                Bienvenido de nuevo
              </h1>
              <p className="mt-2 text-sm leading-6 text-secondary">
                Accede con tus credenciales de restaurante para continuar gestionando recetas, mermas, inventario y márgenes.
              </p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Correo electrónico institucional
                </label>
                <div className="relative">
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    className="input bg-[#fafafa] pl-10 pr-3.5 text-sm font-medium focus:bg-white"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="owner@calculatechef.com"
                    required
                    aria-describedby={error ? "login-error" : undefined}
                    aria-invalid={Boolean(error)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Contraseña
                  </label>
                  <button type="button" onClick={showAccessHelp} className="min-h-11 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)] hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className={`input bg-[#fafafa] pl-10 pr-12 text-sm focus:bg-white ${showPassword ? "" : "font-mono tracking-[0.15em]"}`}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Ingresa tu contraseña"
                    required
                    aria-describedby={error ? "login-error" : undefined}
                    aria-invalid={Boolean(error)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                  >
                    <span className="material-symbols-outlined text-[19px]" aria-hidden>{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              {error ? (
                <p id="login-error" className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center gap-2 text-xs text-secondary">
                <span className="material-symbols-outlined text-[17px] text-[var(--success-text)]" aria-hidden>verified_user</span>
                Tu sesión se protege con conexión cifrada.
              </div>

              <Button type="submit" variant="primary" isLoading={loading} loadingLabel="Ingresando…" className="w-full shadow-md">
                <span>Entrar al sistema</span>
                <span className="material-symbols-outlined text-[18px] text-slate-300" aria-hidden>arrow_forward</span>
              </Button>
            </form>

            {/* <div id="login-help" className="mt-8 border-t border-[var(--border-subtle)] pt-6">
              <p className="text-center text-xs leading-5 text-tertiary">
                Si no dispones de acceso o expiró tu turno, solicita tus credenciales al <strong className="font-medium text-primary">Administrador del Restaurante</strong> o al Sous-Chef ejecutivo.
              </p>
              <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[#fafafa] px-3 py-2 text-center text-[11px] text-secondary">
                <span className="material-symbols-outlined shrink-0 text-[16px] text-[var(--success-text)]" aria-hidden>shield</span>
                Auditoría de escandallos con conexión segura activa
              </div>
            </div> */}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] bg-white/50 px-4 py-5 text-xs text-tertiary backdrop-blur-sm sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <div>
            <p>CalculaChef SaaS. Control de mermas, escandallos y precisión culinaria.</p>
            <p className="mt-0.5 text-[11px] text-muted">Operación gastronómica con trazabilidad de costos.</p>
          </div>
          <div className="flex items-center gap-5 text-[12px] font-medium" aria-label="Compromisos de la plataforma">
            <span>Privacidad de fórmulas</span>
            <span>Acceso seguro</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
