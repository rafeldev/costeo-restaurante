"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useDeferredValue, useRef, useState, type KeyboardEvent } from "react";
import {
  CATEGORIAS_GLOSARIO,
  filtrarTerminosGlosario,
  TERMINOS_GLOSARIO,
  type CategoriaGlosario,
  type FiltroCategoriaGlosario,
} from "@/lib/glosario";
import { calculateSuggestedPrice } from "@/lib/pricing/calculateSuggestedPrice";
import { useOnboardingTour } from "@/components/onboarding/useOnboardingTour";

const FILTROS: readonly FiltroCategoriaGlosario[] = ["Todos", ...CATEGORIAS_GLOSARIO];

const EJEMPLO_PRECIO = calculateSuggestedPrice({
  costoMateriaPrima: 3650,
  rendimientoPorciones: 1,
  overheadPct: 15,
  margenObjetivoPct: 53,
  impuestoPct: 8,
  redondeoPrecio: 50,
});

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/insumos", label: "Insumos" },
  { href: "/recetas", label: "Recetas" },
  { href: "/producciones", label: "Producciones" },
  { href: "/configuracion", label: "Configuración" },
] as const;

const MATRIZ_MENU = [
  {
    nombre: "Platos Estrella (Stars)",
    relacion: "Alta Venta • Alto Margen",
    descripcion:
      "Tus campeones indiscutibles. El comensal los pide con devoción y dejan un margen financiero óptimo en caja.",
    estrategia:
      "Proteger la receta sagrada. No modificar insumos ni porciones. Dar máxima visibilidad en carta.",
    icono: "star",
    fondo: "bg-[var(--success-surface)]",
    iconoFondo: "bg-green-700/10 text-[var(--success-text)]",
    relacionColor: "text-[var(--success-text)]",
    estrategiaColor: "text-[var(--success-text)]",
  },
  {
    nombre: "Caballos de Batalla (Plowhorses)",
    relacion: "Alta Venta • Bajo Margen",
    descripcion:
      "Altamente populares pero costosos de producir. Atraen clientes masivamente pero aportan poca ganancia neta.",
    estrategia:
      "Subir sutilmente el precio, negociar costo con proveedores o reducir tamaño de guarnición un 10%.",
    icono: "bolt",
    fondo: "bg-[var(--control-bg)]",
    iconoFondo: "bg-slate-900/10 text-primary",
    relacionColor: "text-primary",
    estrategiaColor: "text-secondary",
  },
  {
    nombre: "Puzzles o Enigmas",
    relacion: "Baja Venta • Alto Margen",
    descripcion:
      "Platos muy rentables pero incomprendidos o poco ordenados por la clientela. Tienen un potencial desperdiciado.",
    estrategia:
      "Reubicar en el punto focal del menú, mejorar descripción fotográfica y entrenar al equipo para impulsarlo.",
    icono: "help",
    fondo: "bg-[var(--warning-surface)]",
    iconoFondo: "bg-amber-700/10 text-[var(--warning-text)]",
    relacionColor: "text-[var(--warning-text)]",
    estrategiaColor: "text-[var(--warning-text)]",
  },
  {
    nombre: "Perros o Huesos (Dogs)",
    relacion: "Baja Venta • Bajo Margen",
    descripcion:
      "Nadie los pide con frecuencia y cuando salen, dejan pérdidas o absorben tiempo excesivo en la estación de cocina.",
    estrategia:
      "Eliminar de la carta sin nostalgia. Libera inventario inmovilizado y tiempo del mise en place.",
    icono: "block",
    fondo: "bg-[var(--danger-surface)]",
    iconoFondo: "bg-red-700/10 text-[var(--danger-text)]",
    relacionColor: "text-[var(--danger-text)]",
    estrategiaColor: "text-[var(--danger-text)]",
  },
] as const;

const categoriaClasses: Record<CategoriaGlosario, string> = {
  "Costeo y Escandallo": "bg-[var(--info-surface)] text-[var(--info-text)]",
  "Inventario y Mermas": "bg-[#ffdbca] text-[#773300]",
  "Ingeniería de Menú": "bg-[var(--success-surface)] text-[var(--success-text)]",
  "Métricas Financieras": "bg-[var(--warning-surface)] text-[var(--warning-text)]",
  "Tributación y Precios": "bg-[var(--control-bg)] text-secondary",
};

const recomendacionClasses: Record<CategoriaGlosario, string> = {
  "Costeo y Escandallo": "bg-[var(--warning-surface)] text-[var(--warning-text)]",
  "Inventario y Mermas": "bg-[var(--info-surface)] text-[var(--info-text)]",
  "Ingeniería de Menú": "bg-[var(--info-surface)] text-[var(--info-text)]",
  "Métricas Financieras": "bg-[var(--warning-surface)] text-[var(--warning-text)]",
  "Tributación y Precios": "bg-[var(--warning-surface)] text-[var(--warning-text)]",
};

const recomendacionIconos: Record<CategoriaGlosario, string> = {
  "Costeo y Escandallo": "warning",
  "Inventario y Mermas": "tips_and_updates",
  "Ingeniería de Menú": "payments",
  "Métricas Financieras": "electric_bolt",
  "Tributación y Precios": "account_balance",
};

function MaterialIcon({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined select-none leading-none ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}

export function GlosarioHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "owner@calculatechef.com";

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-20 bg-white shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)]"
            aria-label="CalculaChef, ir al inicio"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ink)] text-white">
              <MaterialIcon className="text-[19px]">restaurant</MaterialIcon>
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-semibold leading-tight tracking-[-0.015em] text-primary">
                CalculaChef
              </span>
              <span className="mt-0.5 text-xs font-semibold leading-none tracking-[0.02em] text-muted">
                Costeo e inventario para restaurantes
              </span>
            </span>
          </Link>
          <span className="hidden h-6 w-px bg-[var(--border-subtle)] xl:block" />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--control-bg)] hover:text-primary ${
                    active ? "bg-[var(--control-bg)] text-primary shadow-sm" : "text-secondary"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href="/glosario"
            className="hidden items-center gap-1 rounded-full bg-[var(--info-surface)] px-4 py-1.5 text-xs font-semibold text-[var(--info-text)] transition-colors hover:bg-sky-100 sm:inline-flex"
            aria-current="page"
          >
            <MaterialIcon className="text-[16px]">school</MaterialIcon>
            Guía de Costeo
          </Link>
          <div className="hidden items-center gap-2 pl-2 md:flex">
            <div className="flex max-w-48 flex-col text-right">
              <span className="truncate text-sm font-medium leading-tight text-primary">{userEmail}</span>
              <span className="mt-0.5 text-xs font-semibold leading-none text-muted">Administrador</span>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-white">
              <MaterialIcon className="text-[18px]">person</MaterialIcon>
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-[var(--danger-surface)] hover:text-[var(--danger-text)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)]"
              aria-label="Cerrar sesión"
            >
              <MaterialIcon className="text-[20px]">logout</MaterialIcon>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function GlosarioFooter() {
  return (
    <footer className="w-full bg-white py-10 shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:px-6 md:flex-row md:text-left">
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--ink)] text-white">
            <MaterialIcon className="text-[15px]">restaurant</MaterialIcon>
          </span>
          <span>© 2025 CalculaChef SaaS. Control de mermas, escandallos y precisión culinaria.</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <Link href="/glosario" className="text-[13px] text-secondary hover:text-primary">
            Glosario Gastronómico
          </Link>
          <span className="rounded-full bg-[var(--success-surface)] px-2 py-0.5 text-xs font-medium text-[var(--success-text)]">
            • Motor de Costeo Operativo
          </span>
        </div>
      </div>
    </footer>
  );
}

export function GlosarioModule() {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<FiltroCategoriaGlosario>("Todos");
  const busquedaDiferida = useDeferredValue(busqueda);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { start: startTour, isRunning: tourIsRunning } = useOnboardingTour();
  const terminos = filtrarTerminosGlosario(TERMINOS_GLOSARIO, busquedaDiferida, categoria);

  function seleccionarConTeclado(
    event: KeyboardEvent<HTMLButtonElement>,
    indiceActual: number,
  ) {
    let siguiente = indiceActual;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      siguiente = (indiceActual + 1) % FILTROS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      siguiente = (indiceActual - 1 + FILTROS.length) % FILTROS.length;
    } else if (event.key === "Home") {
      siguiente = 0;
    } else if (event.key === "End") {
      siguiente = FILTROS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    setCategoria(FILTROS[siguiente]);
    chipRefs.current[siguiente]?.focus();
  }

  function restablecerFiltros() {
    setBusqueda("");
    setCategoria("Todos");
  }

  const costoDirecto = EJEMPLO_PRECIO.costoPorPorcion;
  const overhead = EJEMPLO_PRECIO.precioSugeridoSinImpuesto * 0.15;
  const margen = EJEMPLO_PRECIO.precioSugeridoSinImpuesto * 0.53;

  return (
    <div className="flex w-full flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Migas de pan">
          <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
            <li>
              <Link href="/" className="flex items-center gap-1 transition-colors hover:text-primary">
                <MaterialIcon className="text-[16px]">home</MaterialIcon>
                Inicio
              </Link>
            </li>
            <li aria-hidden="true"><MaterialIcon className="text-[14px]">chevron_right</MaterialIcon></li>
            <li><Link href="/configuracion" className="transition-colors hover:text-primary">Configuración</Link></li>
            <li aria-hidden="true"><MaterialIcon className="text-[14px]">chevron_right</MaterialIcon></li>
            <li className="font-medium text-[var(--accent)]" aria-current="page">Glosario Gastronómico</li>
          </ol>
        </nav>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-[var(--info-surface)] px-4 py-1 text-xs font-semibold text-[var(--info-text)]">
            <MaterialIcon className="text-[14px]">auto_stories</MaterialIcon>
            Norma Técnica NIIF Gastronómica v2.4
          </span>
          <span className="hidden text-[13px] text-muted sm:inline">•</span>
          <span className="hidden text-[13px] text-secondary sm:inline">Actualizado Q1 2025</span>
        </div>
      </div>

      <header className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="flex max-w-3xl flex-col gap-2">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              Cultura Financiera de Cocina
            </p>
            <h1 className="text-[2rem] font-bold leading-10 tracking-[-0.025em] text-primary">
              Glosario Gastronómico y Cultura de Costeo
            </h1>
            <p className="text-base leading-[1.625rem] text-secondary">
              Diccionario técnico y guía pedagógica de costeo culinario, ingeniería de menú y finanzas operativas para chefs ejecutivos, administradores de alimentos y bebidas, y operadores restauranteros.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start lg:self-auto">
            <button type="button" disabled title="La descarga estará disponible próximamente" className="inline-flex min-h-11 cursor-not-allowed items-center gap-1 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-primary opacity-60 shadow-sm">
              <MaterialIcon className="text-[18px]">download</MaterialIcon>
              Descargar PDF
            </button>
            <Link href="/recetas" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700">
              <MaterialIcon className="text-[18px]">calculate</MaterialIcon>
              Ir al Escandallador
            </Link>
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-[var(--shadow-card)]" aria-labelledby="buscar-glosario">
          <h2 id="buscar-glosario" className="sr-only">Buscar y filtrar términos</h2>
          <label htmlFor="glossary-search" className="sr-only">Buscar en el glosario</label>
          <div className="relative w-full">
            <MaterialIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-muted">search</MaterialIcon>
            <input
              id="glossary-search"
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className="min-h-12 w-full rounded-lg border-0 bg-[var(--control-bg)] py-3 pl-11 pr-11 text-sm text-primary outline-none transition-shadow placeholder:text-muted focus:bg-white focus:shadow-md"
              placeholder="Buscar término, fórmula o sigla culinaria... (ej. Food Cost, Mark-up, Merma, AP/EP, BCG)"
            />
            {busqueda ? (
              <button type="button" onClick={() => setBusqueda("")} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)]" aria-label="Limpiar búsqueda">
                <MaterialIcon className="text-[18px]">close</MaterialIcon>
              </button>
            ) : null}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por categoría">
            {FILTROS.map((filtro, indice) => {
              const activo = categoria === filtro;
              const cantidad = filtro === "Todos" ? TERMINOS_GLOSARIO.length : null;
              return (
                <button
                  key={filtro}
                  ref={(node) => { chipRefs.current[indice] = node; }}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setCategoria(filtro)}
                  onKeyDown={(event) => seleccionarConTeclado(event, indice)}
                  className={`min-h-8 shrink-0 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)] ${activo ? "bg-[var(--ink)] text-white" : "bg-[var(--control-bg)] text-secondary hover:bg-slate-200 hover:text-primary"}`}
                >
                  {filtro}{cantidad === null ? "" : ` (${cantidad})`}
                </button>
              );
            })}
          </div>
        </section>
      </header>

      <section className="relative overflow-hidden rounded-xl bg-white p-6 shadow-[var(--shadow-card)] lg:p-10" aria-labelledby="formula-maestra">
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-[#ffdbca]/30 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ffdbca] text-[var(--accent)]"><MaterialIcon className="text-[20px]">lightbulb</MaterialIcon></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Fórmula Maestra de Rentabilidad</p>
                <h2 id="formula-maestra" className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-primary">Mark-up Arbitrario vs. Fórmula de Precio Venta Público (PVP)</h2>
              </div>
            </div>
            <span className="self-start rounded-full bg-[var(--control-bg)] px-3 py-1 text-xs font-semibold text-secondary md:self-auto">Decisiones basadas en costos verificables</span>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="flex flex-col justify-between gap-4 lg:col-span-5">
              <div className="flex flex-col gap-2 text-sm leading-6 text-secondary">
                <p>El error más destructivo en gastronomía es calcular el precio multiplicando el costo por un factor simple (ej. <strong className="font-medium text-primary">Costo × 3</strong>) o simplemente sumarle un 30%.</p>
                <p>Un margen comercial real debe calcularse sobre el <strong className="text-primary">Precio de Venta Neto</strong>, considerando que de cada peso que entra a caja se deben amortizar automáticamente los <strong className="text-primary">Costos Indirectos (Overhead)</strong> y el <strong className="text-primary">Margen Neto Deseado</strong>.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1 rounded-lg bg-[var(--danger-surface)] p-4 text-[var(--danger-text)] shadow-sm">
                  <span className="flex items-center gap-1 text-xs font-semibold"><MaterialIcon className="text-[16px]">cancel</MaterialIcon>Error Lineal Típico</span>
                  <span className="text-xs font-semibold text-secondary line-through">$4.000 Costo + 30% = $5.200</span>
                  <span className="text-[13px] leading-5">El margen final real cae al 23% tras pagar costos fijos y mermas.</span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg bg-[var(--success-surface)] p-4 text-[var(--success-text)] shadow-sm">
                  <span className="flex items-center gap-1 text-xs font-semibold"><MaterialIcon className="text-[16px]">check_circle</MaterialIcon>Fórmula Científica</span>
                  <span className="text-xs font-semibold text-secondary">División por Fondo Residual</span>
                  <span className="text-[13px] leading-5">Garantiza el margen definido después de impuestos y costos indirectos.</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-4 rounded-xl bg-[var(--control-bg)] p-4 md:p-6 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-primary">Estructura Matemática de Cálculo</span>
                <span className="text-xs font-semibold text-muted">Ejemplo: Hamburguesa Artesanal Clásica</span>
              </div>
              <div className="overflow-x-auto rounded-lg bg-white p-4 font-mono text-[13px] leading-relaxed text-primary shadow-sm">
                <div className="font-semibold text-[var(--accent)]">
                  {"// Fórmula Estandarizada CalculaChef"}
                </div>
                <div className="py-1 whitespace-nowrap"><span className="text-secondary">PVP Neto = </span><strong>[ Costo Directo Receta ]</strong><span className="text-secondary"> / </span><strong className="text-[var(--info-text)]">(1 - % Overhead - % Margen Objetivo)</strong></div>
                <div className="pt-1 text-[11px] text-muted">PVP Final Carta = PVP Neto × (1 + % Impuesto al Consumo/IVA)</div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="flex flex-col rounded-lg bg-white p-2.5 shadow-sm"><dt className="text-xs font-semibold text-muted">Costo Directo</dt><dd className="mt-0.5 text-lg font-semibold text-primary">{formatoMoneda.format(costoDirecto)}</dd><span className="mt-0.5 text-[13px] font-medium text-[var(--accent)]">32% Food Cost</span></div>
                <div className="flex flex-col rounded-lg bg-white p-2.5 shadow-sm"><dt className="text-xs font-semibold text-muted">Overhead C.I.F</dt><dd className="mt-0.5 text-lg font-semibold text-primary">{formatoMoneda.format(overhead)}</dd><span className="mt-0.5 text-[13px] text-secondary">15% Costo Fijo</span></div>
                <div className="flex flex-col rounded-lg bg-white p-2.5 shadow-sm"><dt className="text-xs font-semibold text-muted">Margen Neto</dt><dd className="mt-0.5 text-lg font-semibold text-primary">{formatoMoneda.format(margen)}</dd><span className="mt-0.5 text-[13px] font-medium text-[var(--success-text)]">53% Retorno Bruto</span></div>
                <div className="flex flex-col rounded-lg bg-[var(--ink)] p-2.5 text-white shadow-sm"><dt className="text-xs font-semibold text-[#bec6e0]">PVP con Impuestos</dt><dd className="mt-0.5 text-lg font-semibold">{formatoMoneda.format(EJEMPLO_PRECIO.precioSugeridoFinal)}</dd><span className="mt-0.5 text-[13px] text-[#ffdbca]">Precio Carta Sugerido</span></div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-[var(--shadow-card)]" aria-labelledby="matriz-menu">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--info-text)]">Técnica Estratégica</p>
            <h2 id="matriz-menu" className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-primary">Matriz BCG Culinaria (Ingeniería de Menú de Miller &amp; Kasavana)</h2>
          </div>
          <p className="text-[13px] leading-5 text-secondary">Evaluación bidimensional: Popularidad (Ventas) vs. Rentabilidad (Margen de Contribución)</p>
        </div>
        <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2 lg:grid-cols-4">
          {MATRIZ_MENU.map((cuadrante) => (
            <article key={cuadrante.nombre} className={`flex min-h-72 flex-col justify-between gap-4 rounded-xl p-4 ${cuadrante.fondo}`}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cuadrante.iconoFondo}`}><MaterialIcon className="text-[18px]">{cuadrante.icono}</MaterialIcon></span>
                  <span className={`rounded-full bg-white px-2 py-0.5 text-right text-xs font-semibold shadow-sm ${cuadrante.relacionColor}`}>{cuadrante.relacion}</span>
                </div>
                <h3 className="mt-1 text-lg font-semibold leading-7 tracking-[-0.015em] text-primary">{cuadrante.nombre}</h3>
                <p className="text-[13px] leading-5 text-secondary">{cuadrante.descripcion}</p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg bg-white/90 p-2.5 shadow-sm">
                <span className="text-xs font-semibold text-primary">Estrategia Operativa:</span>
                <span className={`text-[13px] leading-5 ${cuadrante.estrategiaColor}`}>• {cuadrante.estrategia}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6" aria-labelledby="terminos-clave">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Matriz Conceptual</p>
            <h2 id="terminos-clave" className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-primary">Términos Clave y Directrices Operativas</h2>
          </div>
          <p className="shrink-0 text-xs font-semibold text-muted" aria-live="polite">Mostrando {terminos.length} de {TERMINOS_GLOSARIO.length} términos</p>
        </div>
        {terminos.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {terminos.map((termino) => (
              <article key={termino.id} className="flex flex-col justify-between gap-4 rounded-xl bg-white p-6 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md [content-visibility:auto] [contain-intrinsic-size:auto_390px]">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${categoriaClasses[termino.categoria]}`}>{termino.categoria}</span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-secondary"><span className="h-2 w-2 rounded-full bg-[var(--success-text)]" />{termino.indicador}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-primary">{termino.nombre}</h3>
                    <p className="mt-1 text-sm leading-6 text-secondary">{termino.definicion}</p>
                  </div>
                  <div className="flex flex-col gap-1 rounded-lg bg-[var(--control-bg)] p-2 font-mono text-[13px] text-primary">
                    <span className="font-sans text-[11px] font-medium uppercase tracking-wider text-muted">{termino.formulaTitulo}</span>
                    <code className="overflow-x-auto">{termino.formula}</code>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <div className={`flex items-start gap-1 rounded-lg p-2 ${recomendacionClasses[termino.categoria]}`}>
                    <MaterialIcon className="mt-0.5 shrink-0 text-[18px]">{recomendacionIconos[termino.categoria]}</MaterialIcon>
                    <p className="text-[13px] leading-5 text-primary"><strong className="text-current">Aplicación práctica:</strong> {termino.recomendacion}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1 text-xs text-muted"><span>{termino.aplicacion}</span><span className="shrink-0 font-medium text-primary">Directriz operativa</span></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-10 text-center shadow-[var(--shadow-card)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--control-bg)] text-muted"><MaterialIcon className="text-[24px]">search_off</MaterialIcon></span>
            <div className="max-w-md"><h3 className="text-lg font-semibold text-primary">No se encontraron términos coincidentes</h3><p className="mt-1 text-sm leading-6 text-secondary">Prueba buscando con palabras clave como <strong className="font-medium text-primary">“Yield”, “Margen” o “Escandallo”</strong>, o restablece los filtros.</p></div>
            <button type="button" onClick={restablecerFiltros} className="min-h-11 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)]">Restablecer Filtros</button>
          </div>
        )}
      </section>

      <section className="flex flex-col items-center justify-between gap-6 rounded-xl bg-[#131b2e] p-6 text-white shadow-[var(--shadow-card)] lg:flex-row lg:p-10" aria-labelledby="manual-operativo">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ff8d47] text-[#6b2d00]"><MaterialIcon className="text-[28px]">menu_book</MaterialIcon></span>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#ffdbca]">Material Formativo de Equipo</p>
            <h2 id="manual-operativo" className="text-2xl font-semibold leading-8 tracking-[-0.02em]">Manual Operativo de Mermas y Fichas Técnicas</h2>
            <p className="max-w-xl text-sm leading-6 text-[#bec6e0]">Descarga las plantillas estandarizadas en PDF para imprimir en las estaciones de cocción fría, caliente y bar para capacitar a tus cocineros en el pesaje de mermas.</p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col items-center gap-2 sm:w-auto sm:flex-row">
          <button type="button" disabled={tourIsRunning} onClick={startTour} className="inline-flex min-h-12 w-full items-center justify-center gap-1 rounded-lg border border-white/30 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><MaterialIcon className="text-[18px]">tour</MaterialIcon>Repetir recorrido</button>
          <button type="button" disabled title="La descarga estará disponible próximamente" className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-1 rounded-lg bg-white px-4 py-3 text-sm font-medium text-primary opacity-60 shadow-sm sm:w-auto"><MaterialIcon className="text-[18px]">download</MaterialIcon>Descargar Manual PDF (3.2 MB)</button>
          <Link href="/configuracion" className="inline-flex min-h-12 w-full items-center justify-center gap-1 rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)] sm:w-auto"><MaterialIcon className="text-[18px]">tune</MaterialIcon>Ajustar Parámetros de Costeo</Link>
        </div>
      </section>
    </div>
  );
}
