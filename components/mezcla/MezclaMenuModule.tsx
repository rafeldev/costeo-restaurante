"use client";

import { useEffect, useMemo, useState } from "react";
import type { MezclaMenuDTO } from "@/lib/api-types";
import { categoriaRecetaLabels, categoriaRecetaValues, type CategoriaRecetaValue } from "@/lib/domain";
import { formatMoney, formatPercent } from "@/lib/format";
import type { Cuadrante } from "@/lib/menu-engineering";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EducationalCallout } from "@/components/ui/EducationalCallout";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { KpiCard } from "@/components/ui/KpiCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { toast } from "sonner";

type MezclaItem = MezclaMenuDTO["items"][number];
type OrdenKey = "nombre" | "unidades" | "margen" | "foodCost";

const ordenOptions: Array<{ key: OrdenKey; label: string }> = [
  { key: "nombre", label: "Nombre (A-Z)" },
  { key: "unidades", label: "Más vendidas" },
  { key: "margen", label: "Mayor margen total" },
  { key: "foodCost", label: "Mayor food cost %" },
];

const cuadranteTone: Record<Cuadrante, BadgeTone> = {
  Estrella: "success",
  "Caballo de Batalla": "warning",
  Puzzle: "info",
  Perro: "danger",
  "Sin dato": "neutral",
};

const cuadranteCards: Array<{ key: Cuadrante; description: string }> = [
  { key: "Estrella", description: "Popular y rentable: protégela y mantenla visible en la carta." },
  { key: "Caballo de Batalla", description: "Vende mucho, pero con margen bajo: ajusta precio o costo." },
  { key: "Puzzle", description: "Deja buen margen, pero casi no se vende: promociónala." },
  { key: "Perro", description: "No vende ni deja margen: evalúa retirarla del menú." },
];

function currentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftPeriodo(periodo: string, delta: number): string {
  const [year, month] = periodo.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function periodoLabel(periodo: string): string {
  const [year, month] = periodo.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MezclaMenuModule() {
  const [periodo, setPeriodo] = useState(currentPeriodo);
  const [data, setData] = useState<MezclaMenuDTO | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<"" | CategoriaRecetaValue>("");
  const [orden, setOrden] = useState<OrdenKey>("nombre");
  const [ediciones, setEdiciones] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  async function loadData(targetPeriodo: string, signal?: AbortSignal) {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch(`/api/ventas-recetas?periodo=${targetPeriodo}`, { signal });
      if (!response.ok) throw new Error("No se pudo cargar la mezcla de menú.");
      const body: MezclaMenuDTO = await response.json();
      setData(body);
      setEdiciones({});
      setStatus("ready");
    } catch (loadError) {
      if ((loadError as Error).name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
      setStatus("error");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadData(periodo, controller.signal);
    return () => controller.abort();
  }, [periodo]);

  function unidadesCambiadas(itemsActuales: MezclaItem[], cambios: Record<string, number>) {
    return Object.entries(cambios)
      .filter(([recetaId, unidades]) => {
        const item = itemsActuales.find((i) => i.recetaId === recetaId);
        return item !== undefined && item.unidadesVendidas !== unidades;
      })
      .map(([recetaId, unidadesVendidas]) => ({ recetaId, unidadesVendidas }));
  }

  async function guardarUnidades() {
    if (!data) return;
    const cambios = unidadesCambiadas(data.items, ediciones);
    if (cambios.length === 0) return;

    setSaving(true);
    try {
      const response = await fetch("/api/ventas-recetas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo, items: cambios }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudieron guardar las unidades.");
      }
      await loadData(periodo);
      toast.success("Unidades guardadas");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  function setUnidad(recetaId: string, unidades: number) {
    setEdiciones((current) => ({ ...current, [recetaId]: Math.max(0, Math.round(unidades)) }));
  }

  const cambiosPendientes = useMemo(
    () => (data ? unidadesCambiadas(data.items, ediciones).length : 0),
    [data, ediciones],
  );

  const visibleItems = useMemo(() => {
    if (!data) return [];
    const filtered = filtroCategoria ? data.items.filter((item) => item.categoria === filtroCategoria) : data.items;
    const sorted = [...filtered];
    if (orden === "nombre") sorted.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    if (orden === "unidades") sorted.sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);
    if (orden === "margen") sorted.sort((a, b) => (b.margenTotal ?? -Infinity) - (a.margenTotal ?? -Infinity));
    if (orden === "foodCost") sorted.sort((a, b) => (b.foodCostPct ?? -Infinity) - (a.foodCostPct ?? -Infinity));
    return sorted;
  }, [data, filtroCategoria, orden]);

  const cuadrantes = useMemo(() => {
    const groups: Record<Cuadrante, MezclaItem[]> = {
      Estrella: [],
      "Caballo de Batalla": [],
      Puzzle: [],
      Perro: [],
      "Sin dato": [],
    };
    for (const item of data?.items ?? []) groups[item.cuadrante].push(item);
    return groups;
  }, [data]);

  const sinRecetasActivas = status === "ready" && (data?.items.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Periodo anterior"
            className="btn-secondary flex h-11 w-11 shrink-0 items-center justify-center p-0 text-base"
            onClick={() => setPeriodo((current) => shiftPeriodo(current, -1))}
          >
            ‹
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-primary">{periodoLabel(periodo)}</span>
          <button
            type="button"
            aria-label="Periodo siguiente"
            className="btn-secondary flex h-11 w-11 shrink-0 items-center justify-center p-0 text-base"
            onClick={() => setPeriodo((current) => shiftPeriodo(current, 1))}
          >
            ›
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" disabled title="Próximamente">
            Descargar Reporte
          </button>
          <button type="button" className="btn-secondary" disabled title="Próximamente">
            Importar ventas (CSV)
          </button>
        </div>
      </div>

      {status === "loading" ? <LoadingState message="Cargando mezcla de menú…" /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void loadData(periodo)} /> : null}
      {sinRecetasActivas ? (
        <EmptyState
          title="No hay recetas activas"
          description="Crea y activa recetas en el catálogo para poder registrar sus ventas."
        />
      ) : null}

      {status === "ready" && data && !sinRecetasActivas ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Unidades Vendidas" value={data.kpis.unidadesVendidas.toLocaleString("es-CO")} description="Total registrado en el periodo" />
            <KpiCard
              title="Food Cost Ponderado"
              value={data.kpis.foodCostPonderadoPct === null ? "—" : formatPercent(data.kpis.foodCostPonderadoPct)}
              description="Promedio ponderado por ventas"
            />
            <KpiCard
              title="Mayor Impacto Económico"
              value={data.kpis.mayorImpacto ? formatMoney(data.kpis.mayorImpacto.margenTotal) : "—"}
              description={data.kpis.mayorImpacto ? data.kpis.mayorImpacto.nombre : "Sin ventas registradas este periodo"}
            />
            <KpiCard
              title="Sin Dato de Ventas"
              value={String(data.kpis.sinDato)}
              trend={data.kpis.sinDato > 0 ? "Pendiente" : "Completo"}
              trendTone={data.kpis.sinDato > 0 ? "warning" : "success"}
              description="Recetas sin unidades registradas"
            />
          </section>

          <EducationalCallout title="Popularidad × Rentabilidad: la matriz de ingeniería de menú">
            Cada receta se clasifica cruzando dos variables: cuántas unidades vendiste (popularidad) y cuánto margen deja cada
            una (rentabilidad). Las <strong>Estrella</strong> son populares y rentables: protégelas. Los{" "}
            <strong>Caballo de Batalla</strong> venden mucho con margen bajo: ajusta precio o costo. Los <strong>Puzzle</strong>{" "}
            dejan buen margen pero casi no se venden: promociónalos. Los <strong>Perro</strong> no venden ni dejan margen:
            evalúa retirarlos del menú.
          </EducationalCallout>

          <section className="surface-card space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoría">
                <button
                  type="button"
                  aria-pressed={filtroCategoria === ""}
                  className={`min-h-9 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filtroCategoria === "" ? "bg-[var(--ink)] text-white" : "bg-[var(--control-bg)] text-secondary hover:text-primary"}`}
                  onClick={() => setFiltroCategoria("")}
                >
                  Todas
                </button>
                {categoriaRecetaValues.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filtroCategoria === value}
                    className={`min-h-9 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filtroCategoria === value ? "bg-[var(--ink)] text-white" : "bg-[var(--control-bg)] text-secondary hover:text-primary"}`}
                    onClick={() => setFiltroCategoria(value)}
                  >
                    {categoriaRecetaLabels[value]}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="shrink-0 text-secondary">Ordenar por</span>
                <select
                  className="input h-11 max-w-[220px]"
                  value={orden}
                  onChange={(event) => setOrden(event.target.value as OrdenKey)}
                >
                  {ordenOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {visibleItems.length === 0 ? (
              <EmptyState title="Sin recetas para esta categoría" description="Elige otra categoría o selecciona «Todas»." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-xs font-semibold uppercase tracking-wide text-tertiary">
                      <th className="py-2 pr-3">Receta</th>
                      <th className="py-2 pr-3">Categoría</th>
                      <th className="py-2 pr-3">Unidades</th>
                      <th className="py-2 pr-3 text-right">Costo/porción</th>
                      <th className="py-2 pr-3 text-right">PVP</th>
                      <th className="py-2 pr-3 text-right">Margen unitario</th>
                      <th className="py-2 pr-3 text-right">Margen total</th>
                      <th className="py-2 pr-3 text-right">Food cost %</th>
                      <th className="py-2 pr-3">Cuadrante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {visibleItems.map((item) => {
                      const unidades = ediciones[item.recetaId] ?? item.unidadesVendidas;
                      return (
                        <tr key={item.recetaId}>
                          <td className="py-2 pr-3">
                            <div className="font-medium text-primary">{item.nombre}</div>
                            <div className="text-xs text-tertiary">{item.codigo}</div>
                          </td>
                          <td className="py-2 pr-3 text-secondary">{categoriaRecetaLabels[item.categoria]}</td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label={`Restar unidad a ${item.nombre}`}
                                className="btn-secondary flex h-11 w-11 shrink-0 items-center justify-center p-0 text-base"
                                onClick={() => setUnidad(item.recetaId, unidades - 1)}
                              >
                                −
                              </button>
                              <input
                                aria-label={`Unidades vendidas de ${item.nombre}`}
                                className="input h-11 w-20 text-center"
                                type="number"
                                min="0"
                                step="1"
                                value={unidades}
                                onChange={(event) => setUnidad(item.recetaId, Number(event.target.value) || 0)}
                              />
                              <button
                                type="button"
                                aria-label={`Sumar unidad a ${item.nombre}`}
                                className="btn-secondary flex h-11 w-11 shrink-0 items-center justify-center p-0 text-base"
                                onClick={() => setUnidad(item.recetaId, unidades + 1)}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-primary">{formatMoney(item.costoPorcion)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-primary">{item.pvpCarta === null ? "—" : formatMoney(item.pvpCarta)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-primary">{item.margenUnitario === null ? "—" : formatMoney(item.margenUnitario)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-primary">{item.margenTotal === null ? "—" : formatMoney(item.margenTotal)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-primary">{item.foodCostPct === null ? "—" : formatPercent(item.foodCostPct)}</td>
                          <td className="py-2 pr-3">
                            <Badge tone={cuadranteTone[item.cuadrante]}>{item.cuadrante}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border)] text-sm font-semibold text-primary">
                      <td className="py-2 pr-3" colSpan={2}>
                        Totales
                      </td>
                      <td className="py-2 pr-3">{data.totales.unidadesVendidas.toLocaleString("es-CO")}</td>
                      <td className="py-2 pr-3" colSpan={3} />
                      <td className="py-2 pr-3 text-right font-mono">{formatMoney(data.totales.margenTotal)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              {cambiosPendientes > 0 ? (
                <span className="text-sm text-secondary">
                  {cambiosPendientes} cambio{cambiosPendientes === 1 ? "" : "s"} sin guardar
                </span>
              ) : null}
              <button
                type="button"
                className="btn-accent"
                disabled={cambiosPendientes === 0 || saving}
                onClick={() => void guardarUnidades()}
              >
                {saving ? "Guardando…" : "Guardar Unidades"}
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cuadranteCards.map(({ key, description }) => (
              <article key={key} className="surface-card p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-primary">{key}</h3>
                  <Badge tone={cuadranteTone[key]}>{cuadrantes[key].length}</Badge>
                </div>
                <p className="mt-1 text-xs text-secondary">{description}</p>
                <ul className="mt-3 space-y-2">
                  {cuadrantes[key].length === 0 ? <li className="text-sm text-tertiary">Sin recetas en este cuadrante.</li> : null}
                  {cuadrantes[key].map((item) => (
                    <li key={item.recetaId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-primary">{item.nombre}</span>
                      <span className="shrink-0 text-right text-xs text-secondary">
                        {item.unidadesVendidas} u · {item.margenUnitario === null ? "—" : formatMoney(item.margenUnitario)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
