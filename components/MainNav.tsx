"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/insumos", label: "Insumos" },
  { href: "/recetas", label: "Recetas" },
  { href: "/configuracion", label: "Configuración" },
];

export function MainNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "";
  const userName =
    (session?.user?.name && session.user.name.trim()) ||
    (userEmail ? userEmail.split("@")[0] : "Usuario");

  return (
    <nav className="mb-6 sm:mb-8" aria-label="Navegación principal">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-1.5 shadow-sm sm:p-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-[var(--ink)] text-white"
                      : "text-secondary hover:bg-[var(--border-subtle)] hover:text-primary"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--parchment)] px-2 py-1 sm:justify-end">
            <p className="truncate text-xs text-secondary sm:max-w-[200px]">
              Sesión: <span className="font-medium text-primary">{userName}</span>
            </p>
            <button
              type="button"
              className="btn-secondary inline-flex min-h-9 items-center px-3 text-xs"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
