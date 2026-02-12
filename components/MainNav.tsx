"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/insumos", label: "Insumos" },
  { href: "/recetas", label: "Recetas" },
  { href: "/configuracion", label: "Configuración" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 sm:mb-8">
      <div className="surface-card p-1.5">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
