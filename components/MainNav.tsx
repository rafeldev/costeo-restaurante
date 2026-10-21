"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useSyncExternalStore } from "react";
import { useOnboardingTour } from "@/components/onboarding/useOnboardingTour";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/insumos", label: "Insumos" },
  { href: "/recetas", label: "Recetas" },
  { href: "/mezcla", label: "Mezcla" },
  { href: "/producciones", label: "Producciones" },
  { href: "/configuracion", label: "Configuración" },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function subscribeToInventoryTab(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("insumos-tab-change", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("insumos-tab-change", onStoreChange);
  };
}

function isInventoryTab() {
  return new URLSearchParams(window.location.search).get("tab") === "inventario";
}

export function MainNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const restaurantName = session?.user?.name ?? "Mi restaurante";
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const inventoryTab = useSyncExternalStore(subscribeToInventoryTab, isInventoryTab, () => false);
  const { start: startTour, isRunning: tourIsRunning } = useOnboardingTour();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-20 bg-white shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="CalculaChef, inicio">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c25e19] font-bold text-white">C</span>
            <span className="flex flex-col">
              <span className="text-[18px] font-semibold leading-tight tracking-[-0.015em] text-[#0f172a]">CalculaChef</span>
              <span className="mt-0.5 max-w-48 truncate text-xs font-semibold leading-none tracking-[0.02em] text-[#94a3b8]">{restaurantName}</span>
            </span>
          </Link>
          <span className="hidden h-6 w-px bg-[#e2e8f0] xl:block" />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal" data-tour="nav-principal">
            {navItems.map((item) => {
              const active = isCurrent(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-[#f1f5f9] text-[#0f172a] shadow-sm" : "text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden items-center gap-2 pl-2 md:flex">
            <span className="flex flex-col text-right">
              <span className="max-w-[210px] truncate text-sm font-medium leading-tight text-[#0f172a]">{email}</span>
              <span className="mt-0.5 text-xs font-semibold leading-none text-[#94a3b8]">Cuenta del restaurante</span>
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white"><span className="material-symbols-outlined text-[18px]">person</span></span>
            <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#fef2f2] hover:text-[#b91c1c]" aria-label="Cerrar sesión">
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg text-[#475569] hover:bg-[#f1f5f9] lg:hidden" aria-label="Abrir navegación" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span className="material-symbols-outlined text-[24px]" aria-hidden>{menuOpen ? "close" : "menu"}</span></button>
        </div>
      </div>
        {menuOpen ? <nav className="absolute right-4 top-[68px] w-64 rounded-xl bg-white p-2 shadow-[0_12px_30px_rgba(15,23,42,0.16)] lg:hidden" aria-label="Navegación móvil">{navItems.map((item) => { const active = isCurrent(pathname, item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)} className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${active ? "bg-[#f1f5f9] text-[#0f172a]" : "text-[#475569]"}`}>{item.label}</Link>; })}<button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="flex min-h-11 w-full items-center rounded-lg px-3 text-sm font-medium text-[#b91c1c]">Cerrar sesión</button></nav> : null}
      </header>

      <div className={`fixed right-4 z-40 flex flex-col items-end gap-2 transition-[bottom] sm:right-6 ${pathname === "/insumos" && inventoryTab ? "bottom-32 sm:bottom-24" : "bottom-4 sm:bottom-6"}`}>
        {helpOpen ? (
          <div id="help-actions" className="w-56 rounded-xl bg-white p-2 shadow-[var(--shadow-modal)]" aria-label="Guía y recorrido">
            <Link href="/glosario" onClick={() => setHelpOpen(false)} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#0369a1] transition-colors hover:bg-[#f0f9ff]">
              <span className="material-symbols-outlined text-[19px]" aria-hidden>school</span>
              Guía de Costeo
            </Link>
            <button type="button" disabled={tourIsRunning} onClick={() => { setHelpOpen(false); startTour(); }} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#475569] transition-colors hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-50">
              <span className="material-symbols-outlined text-[19px]" aria-hidden>tour</span>
              Ver recorrido
            </button>
          </div>
        ) : null}
        <button type="button" data-tour="guia-costeo" onClick={() => setHelpOpen((open) => !open)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#0f172a] px-4 text-sm font-semibold text-white shadow-[var(--shadow-modal)] transition-colors hover:bg-[#334155] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)]" aria-label={`${helpOpen ? "Cerrar" : "Abrir"} Guía de Costeo y recorrido`} aria-expanded={helpOpen} aria-controls="help-actions">
          <span className="material-symbols-outlined text-[20px]" aria-hidden>{helpOpen ? "close" : "help"}</span>
          <span className="hidden sm:inline">Guía y recorrido</span>
        </button>
      </div>
    </>
  );
}
