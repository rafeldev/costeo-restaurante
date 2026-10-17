"use client";

import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type {
  ConfigCosteoDTO,
  InsumoDTO,
  PaginatedResponse,
  RecetaCatalogoDTO,
  RecetasResumenDTO,
} from "@/lib/api-types";
import {
  categoriaRecetaLabels,
  categoriaRecetaValues,
  unidadBaseShort,
  type CategoriaRecetaValue,
} from "@/lib/domain";
import { formatMoney, formatPercent } from "@/lib/format";
import { calculateSuggestedPrice } from "@/lib/pricing/calculateSuggestedPrice";
import {
  calculateFoodCostPct,
  getRecipeProfitabilityGuidance,
  type RecipeProfitabilityGuidance,
  type RecipeProfitabilityGuidanceKind,
} from "@/lib/pricing/getRecipeProfitabilityGuidance";
import { applyWasteYield } from "@/lib/unit-conversion";
import { recetaSchema } from "@/lib/validation";
import {
  omitPendingDeletes,
  removeOptimistically,
  restoreOptimistically,
} from "@/lib/optimistic-delete";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { toast } from "sonner";

type RecipeFormValues = z.input<typeof recetaSchema>;
type CatalogTab = "todas" | "rentable" | "ajustar" | "riesgo";
type ImportReport = { creados: number; errores: Array<{ fila: number; motivo: string }> };
type RecetasModuleProps = { filterInsumoId?: string | null };

const PAGE_SIZE = 6;
const defaultValues: RecipeFormValues = {
  nombre: "",
  categoria: "PLATOS_FUERTES",
  rendimientoPorciones: 1,
  tiempoPreparacionMin: undefined,
  precioVentaActual: undefined,
  borrador: false,
  activa: true,
  ingredientes: [{ insumoId: "", cantidad: 1 }],
};

const card = "rounded-xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]";
const field = "h-11 w-full rounded-lg border-0 bg-white px-3 text-sm text-[#0f172a] shadow-[0_1px_3px_rgba(15,23,42,0.12)] outline-none transition focus:ring-2 focus:ring-[#c25e19]";
const softField = "h-10 w-full rounded-lg border-0 bg-[#f1f5f9] px-3 text-[13px] text-[#0f172a] outline-none transition focus:ring-2 focus:ring-[#c25e19]";
const catalogTabs: Array<{ key: CatalogTab; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "rentable", label: "Rentables" },
  { key: "ajustar", label: "Oportunidades / ajustes" },
  { key: "riesgo", label: "Críticas" },
];

function Icon({ children, className = "" }: { children: string; className?: string }) {
  return <span aria-hidden="true" className={`material-symbols-outlined leading-none ${className}`}>{children}</span>;
}

function toneFor(kind: RecipeProfitabilityGuidanceKind) {
  if (kind === "critical") return { text: "text-[#b91c1c]", bg: "bg-[#fef2f2]", border: "border-[#fecaca]", bar: "bg-[#b91c1c]", icon: "error" };
  if (kind === "adjustment") return { text: "text-[#b45309]", bg: "bg-[#fffbeb]", border: "border-[#fde68a]", bar: "bg-[#b45309]", icon: "warning" };
  if (kind === "opportunity") return { text: "text-[#0369a1]", bg: "bg-[#f0f9ff]", border: "border-[#bae6fd]", bar: "bg-[#0369a1]", icon: "trending_up" };
  if (kind === "healthy") return { text: "text-[#15803d]", bg: "bg-[#f0fdf4]", border: "border-[#bbf7d0]", bar: "bg-[#15803d]", icon: "check_circle" };
  return { text: "text-[#64748b]", bg: "bg-[#f1f5f9]", border: "border-[#e2e8f0]", bar: "bg-[#94a3b8]", icon: "sell" };
}

function guidanceCopy(receta: RecetaCatalogoDTO, guidance: RecipeProfitabilityGuidance) {
  if (guidance.kind === "missing-price") {
    return {
      headline: "Falta definir el PVP de carta",
      detail: `Añade un precio para medir la rentabilidad. PVP sugerido: ${formatMoney(receta.pvpSugerido)}.`,
      cta: "Definir PVP",
    };
  }
  if (guidance.kind === "opportunity") {
    return {
      headline: `${formatPercent(receta.foodCostPct ?? 0)} actual · ${guidance.deviationPct.toFixed(1)} pp por debajo del rango`,
      detail: "El margen es superior al objetivo. Puedes conservar el precio o evaluar una estrategia comercial.",
      cta: "Revisar estrategia",
    };
  }

  const priceAction = guidance.suggestedPriceIncrease > 0 && receta.pvpCarta !== null
    ? `Sube el PVP de ${formatMoney(receta.pvpCarta)} a ${formatMoney(receta.pvpCarta + guidance.suggestedPriceIncrease)} (+${formatMoney(guidance.suggestedPriceIncrease)})`
    : "Revisa el PVP actual";
  const costAction = guidance.targetCostReduction > 0
    ? ` o reduce ${formatMoney(guidance.targetCostReduction)} del costo por porción.`
    : ".";
  return {
    headline: `${formatPercent(receta.foodCostPct ?? 0)} actual · ${guidance.deviationPct.toFixed(1)} pp sobre el objetivo`,
    detail: `${priceAction}${costAction}`,
    cta: "Corregir receta",
  };
}

export function RecetasModule({ filterInsumoId }: RecetasModuleProps = {}) {
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [config, setConfig] = useState<ConfigCosteoDTO | null>(null);
  const [result, setResult] = useState<PaginatedResponse<RecetaCatalogoDTO>>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const [summary, setSummary] = useState<RecetasResumenDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [categoria, setCategoria] = useState<"" | CategoriaRecetaValue>("");
  const [tab, setTab] = useState<CatalogTab>("todas");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const catalogViewKey = `${page}\u0000${deferredQuery}\u0000${categoria}\u0000${tab}\u0000${filterInsumoId ?? ""}`;
  const catalogViewKeyRef = useRef(catalogViewKey);
  const pendingDeletesRef = useRef(new Map<string, string>());

  const form = useForm<RecipeFormValues>({ resolver: zodResolver(recetaSchema), defaultValues });
  const ingredients = useWatch({ control: form.control, name: "ingredientes" });
  const rendimiento = Number(useWatch({ control: form.control, name: "rendimientoPorciones" })) || 1;
  const pvpCarta = Number(useWatch({ control: form.control, name: "precioVentaActual" })) || null;
  const ingredientFields = useFieldArray({ control: form.control, name: "ingredientes" });

  const costoMateriaPrima = (ingredients ?? []).reduce((sum, ingredient) => {
    const insumo = insumos.find((item) => item.id === ingredient.insumoId);
    return insumo ? sum + applyWasteYield(Number(ingredient.cantidad) || 0, insumo.mermaPct) * insumo.costoUnidad : sum;
  }, 0);
  const livePricing = config && rendimiento > 0
    ? calculateSuggestedPrice({
        costoMateriaPrima,
        rendimientoPorciones: rendimiento,
        overheadPct: config.overheadPct,
        margenObjetivoPct: config.margenObjetivoPct,
        impuestoPct: config.impuestoPct,
        redondeoPrecio: config.redondeoPrecio,
        precioVentaActual: pvpCarta,
      })
    : null;

  async function loadCatalog(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (deferredQuery) params.set("q", deferredQuery);
    if (categoria) params.set("categoria", categoria);
    if (tab !== "todas") params.set("estado", tab);
    if (filterInsumoId) params.set("insumoId", filterInsumoId);
    try {
      const response = await fetch(`/api/recetas?${params}`, { signal });
      if (!response.ok) throw new Error("No se pudo cargar el catálogo de recetas.");
      const data: PaginatedResponse<RecetaCatalogoDTO> = await response.json();
      if (catalogViewKeyRef.current !== catalogViewKey) return;
      const pendingIds = new Set(
        [...pendingDeletesRef.current].filter(([, viewKey]) => viewKey === catalogViewKey).map(([id]) => id),
      );
      setResult(omitPendingDeletes(data, pendingIds));
    } catch (loadError) {
      if ((loadError as Error).name !== "AbortError") setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  async function loadSupportingData() {
    const [insumosResponse, summaryResponse, configResponse] = await Promise.all([
      fetch("/api/insumos/opciones"),
      fetch("/api/recetas/resumen"),
      fetch("/api/configuracion-costeo"),
    ]);
    if (insumosResponse.ok) setInsumos(await insumosResponse.json());
    if (summaryResponse.ok) setSummary(await summaryResponse.json());
    if (configResponse.ok) setConfig(await configResponse.json());
  }

  const loadCatalogEffect = useEffectEvent(loadCatalog);
  useLayoutEffect(() => {
    catalogViewKeyRef.current = catalogViewKey;
  }, [catalogViewKey]);
  useEffect(() => {
    const controller = new AbortController();
    void loadCatalogEffect(controller.signal);
    return () => controller.abort();
  }, [page, deferredQuery, categoria, tab, filterInsumoId]);
  useEffect(() => { void loadSupportingData(); }, []);

  async function submit(values: RecipeFormValues) {
    const response = await fetch("/api/recetas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo crear la receta.");
    }
    form.reset(defaultValues);
    await Promise.all([loadCatalog(), loadSupportingData()]);
    toast.success(values.borrador ? "Borrador guardado" : "Receta creada");
  }

  async function duplicate(id: string) {
    setDuplicatingId(id);
    try {
      const response = await fetch(`/api/recetas/${id}/duplicar`, { method: "POST" });
      if (!response.ok) throw new Error("No se pudo duplicar la receta.");
      await Promise.all([loadCatalog(), loadSupportingData()]);
      toast.success("Receta duplicada como borrador");
    } catch (duplicateError) {
      toast.error(duplicateError instanceof Error ? duplicateError.message : "Error inesperado");
    } finally {
      setDuplicatingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    const deletion = removeOptimistically(result, id);
    const pageAtDelete = page;
    const viewKeyAtDelete = catalogViewKey;
    const wasOnlyVisibleRow = result.items.length === 1;

    setDeleteConfirmId(null);
    if (!deletion.snapshot) return;

    pendingDeletesRef.current.set(id, viewKeyAtDelete);
    setResult((current) => removeOptimistically(current, id).next);

    try {
      const response = await fetch(`/api/recetas/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudo eliminar la receta.");
      }
    } catch (deleteError) {
      pendingDeletesRef.current.delete(id);
      if (catalogViewKeyRef.current === viewKeyAtDelete) {
        setResult((current) => restoreOptimistically(current, deletion.snapshot!));
      }
      toast.error(deleteError instanceof Error ? deleteError.message : "Error inesperado");
      return;
    }

    if (wasOnlyVisibleRow && pageAtDelete > 1 && catalogViewKeyRef.current === viewKeyAtDelete) {
      setPage((current) => current === pageAtDelete ? current - 1 : current);
    }
    const summaryResponse = await fetch("/api/recetas/resumen").catch(() => null);
    const refreshedSummary = summaryResponse?.ok
      ? await summaryResponse.json().catch(() => null) as RecetasResumenDTO | null
      : null;
    if (refreshedSummary) setSummary(refreshedSummary);
    toast.success("Receta eliminada");
  }

  async function importCsv(file: File) {
    const data = new FormData();
    data.set("archivo", file);
    const response = await fetch("/api/recetas/importar", { method: "POST", body: data });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message ?? "No se pudo importar el recetario.");
    }
    const body: ImportReport = await response.json();
    setImportReport(body);
    await Promise.all([loadCatalog(), loadSupportingData()]);
    toast.success(`${body.creados} recetas importadas`);
  }

  const worst = [...result.items].filter((item) => item.foodCostPct !== null).sort((a, b) => (b.foodCostPct ?? 0) - (a.foodCostPct ?? 0))[0];
  const recipeToDelete = result.items.find((item) => item.id === deleteConfirmId);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const foodCostLive = livePricing && config
    ? calculateFoodCostPct(livePricing.costoPorPorcion, pvpCarta, config.impuestoPct)
    : null;
  const liveGuidance = livePricing && config
    ? getRecipeProfitabilityGuidance({
        costoPorcion: livePricing.costoPorPorcion,
        pvpCarta,
        foodCostPct: foodCostLive,
        impuestoPct: config.impuestoPct,
        foodCostCriticoPct: config.foodCostCriticoPct,
      })
    : null;
  const liveTone = liveGuidance ? toneFor(liveGuidance.kind) : null;

  return (
    <div className="recipes-stitch relative left-1/2 w-[calc(100vw-2rem)] max-w-[1232px] -translate-x-1/2 space-y-6 text-[#191c1e] sm:w-[calc(100vw-3rem)]">
      <style>{`main > header:has(+ .recipes-stitch) { display: none; }`}</style>
      <ConfirmModal open={!!deleteConfirmId} title="Eliminar receta" description="Esta acción no se puede deshacer." confirmLabel="Eliminar" variant="danger" onConfirm={() => void confirmDelete()} onCancel={() => setDeleteConfirmId(null)}>
        {recipeToDelete ? <p>Se eliminará <strong>{recipeToDelete.nombre}</strong>.</p> : null}
      </ConfirmModal>

      <header className={`${card} flex flex-col justify-between gap-4 p-6 md:flex-row md:items-end`}>
        <div className="max-w-3xl space-y-1">
          <div className="mb-2 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[#475569]"><span className="h-1.5 w-1.5 rounded-full bg-[#0369a1]" /> MÓDULO DE FICHAS TÉCNICAS</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fdf4] px-2.5 py-1 text-[#15803d]"><Icon className="text-[14px]">sync</Icon> Sincronizado con Insumos ({insumos.length} activos)</span>
          </div>
          <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em] text-[#0f172a]">Recetas y Escandallos Culinarios</h1>
          <p className="text-sm leading-6 text-[#475569]">Estandariza fichas técnicas maestras, formula ingredientes por porción y calcula automáticamente el costo por ración, Food Cost % y Precio de Venta Sugerido (PVP).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Archivo CSV de recetas" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importCsv(file).catch((importError) => toast.error(importError.message));
            event.target.value = "";
          }} />
          <button type="button" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#f1f5f9] px-4 text-sm font-medium text-[#0f172a] shadow-sm transition hover:bg-[#e2e8f0]" onClick={() => fileInputRef.current?.click()}><Icon className="text-[20px]">upload_file</Icon> Importar Recetario (CSV)</button>
          <button type="button" data-tour="recetas-crear" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#c25e19] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#9a3412]" onClick={() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><Icon className="text-[20px]">add_circle</Icon> Nueva Receta Maestra</button>
        </div>
      </header>

      <section className={`${card} bg-[#f0f9ff] p-6`}>
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex max-w-4xl items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0369a1] text-white shadow-sm"><Icon className="text-[24px]">restaurant_menu</Icon></div>
            <div>
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#0369a1]">Cultura de Costeo <span className="h-1.5 w-1.5 rounded-full bg-[#0369a1]" /> <span className="normal-case text-[#475569]">Control de Mermas</span></p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0f172a]">¿Por qué estandarizar gramajes y rendimiento por ración?</h2>
              <p className="mt-1 text-sm leading-6 text-[#475569]">La inconsistencia en el porcionado genera variabilidad oculta en el costo mensual. Una ficha técnica fija los ingredientes en su unidad base, deduce mermas y arroja el Food Cost real antes de fijar el PVP.</p>
              <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded bg-white px-2.5 py-1 text-xs font-semibold text-[#0f172a] shadow-sm"><Icon className="text-[16px] text-[#c25e19]">functions</Icon><code className="truncate">Costo Porción = Σ (Cantidad × Costo Neto) / Rendimiento</code></span>
            </div>
          </div>
          <Link href="/glosario" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-medium text-[#0369a1] shadow-sm transition hover:bg-[#f1f5f9]">Ver Guía de Escandallo <Icon className="text-[18px]">arrow_forward</Icon></Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Recetas Activas" icon="menu_book" value={summary ? String(summary.activas) : "—"} suffix="platos" badge="Publicadas y disponibles" />
        <Kpi title="Food Cost Promedio" icon="pie_chart" iconTone="text-[#15803d]" value={summary?.foodCostPromedio == null ? "—" : formatPercent(summary.foodCostPromedio)} badge="Rango objetivo: 28% – 35%" />
        <Kpi title="Margen Contribución" icon="trending_up" iconTone="text-[#c25e19]" value={summary?.margenContribucionPromedio == null ? "—" : formatPercent(summary.margenContribucionPromedio)} badge="Promedio sobre PVP carta" />
        <Kpi title="Requieren Revisión" icon="warning" iconTone="text-[#b45309]" value={summary ? String(summary.requierenRevision) : "—"} suffix="platos" badge="Food Cost fuera de objetivo" danger={Boolean(summary?.requierenRevision)} />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <section ref={editorRef} className={`${card} scroll-mt-6 space-y-4 p-6 lg:col-span-5`}>
          <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
            <div><h2 className="text-lg font-semibold tracking-tight text-[#0f172a]">Estandarizar Receta</h2><p className="text-[13px] text-[#475569]">Crea la ficha técnica con cálculo en vivo.</p></div>
            <span className="inline-flex items-center gap-1 rounded bg-[#f1f5f9] px-2 py-1 text-xs font-semibold text-[#475569]"><Icon className="text-[16px] text-[#c25e19]">edit_note</Icon> Ficha nueva</span>
          </div>

          <form className="space-y-4" onSubmit={form.handleSubmit(async (values) => {
            try { await submit(values); } catch (submitError) { toast.error(submitError instanceof Error ? submitError.message : "Error inesperado"); }
          })}>
            <FormLabel label="Nombre de la Receta" error={form.formState.errors.nombre?.message}><input className={field} placeholder="Ej: Salmón Glaseado al Romero" {...form.register("nombre")} /></FormLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FormLabel label="Tipo / Categoría" error={form.formState.errors.categoria?.message}><select className={field} {...form.register("categoria")}>{categoriaRecetaValues.map((value) => <option key={value} value={value}>{categoriaRecetaLabels[value]}</option>)}</select></FormLabel>
              <FormLabel label="Rendimiento (porciones)" error={form.formState.errors.rendimientoPorciones?.message}><input className={field} type="number" min="1" {...form.register("rendimientoPorciones", { valueAsNumber: true })} /></FormLabel>
              <FormLabel label="Tiempo en Cocina" error={form.formState.errors.tiempoPreparacionMin?.message}><input className={field} type="number" min="1" placeholder="Minutos" {...form.register("tiempoPreparacionMin", { setValueAs: (value) => value === "" ? undefined : Number(value) })} /></FormLabel>
              <FormLabel label="PVP Actual Carta" hint="Opcional" error={form.formState.errors.precioVentaActual?.message}><input className={field} type="number" min="0" step="0.01" placeholder="$ 0.00" {...form.register("precioVentaActual", { setValueAs: (value) => value === "" ? undefined : Number(value) })} /></FormLabel>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><h3 className="text-lg font-semibold text-[#0f172a]">Ingredientes</h3><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-semibold text-[#475569]">{ingredientFields.fields.length} añadidos</span></div>
                <button type="button" className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-[#c25e19] hover:text-[#9a3412]" onClick={() => ingredientFields.append({ insumoId: "", cantidad: 1 })}><Icon className="text-[16px]">add_circle</Icon> Añadir línea</button>
              </div>
              <div className="space-y-2">
                {ingredientFields.fields.map((ingredientField, index) => {
                  const selected = insumos.find((item) => item.id === ingredients?.[index]?.insumoId);
                  const amount = Number(ingredients?.[index]?.cantidad) || 0;
                  const lineCost = selected ? applyWasteYield(amount, selected.mermaPct) * selected.costoUnidad : 0;
                  return (
                    <div key={ingredientField.id} className="rounded-lg bg-[#f1f5f9] p-2.5 shadow-sm">
                      <div className="grid grid-cols-[minmax(0,1fr)_92px_34px] items-center gap-2">
                        <select aria-label={`Insumo ${index + 1}`} className="h-9 min-w-0 rounded-md border-0 bg-white px-2 text-[13px] text-[#0f172a] outline-none focus:ring-2 focus:ring-[#c25e19]" {...form.register(`ingredientes.${index}.insumoId` as const)}><option value="">Selecciona insumo...</option>{insumos.map((insumo) => <option key={insumo.id} value={insumo.id}>{insumo.codigo} · {insumo.nombre}</option>)}</select>
                        <input aria-label={`Cantidad ${index + 1}`} className="h-9 min-w-0 rounded-md border-0 bg-white px-2 text-[13px] outline-none focus:ring-2 focus:ring-[#c25e19]" type="number" min="0" step="0.0001" placeholder={selected ? unidadBaseShort[selected.unidadBase] : "Cant."} {...form.register(`ingredientes.${index}.cantidad` as const, { valueAsNumber: true })} />
                        <button aria-label="Quitar ingrediente" title="Quitar ingrediente" type="button" className="flex h-9 w-9 items-center justify-center rounded-md text-[#94a3b8] transition hover:bg-[#fef2f2] hover:text-[#b91c1c] disabled:opacity-30" disabled={ingredientFields.fields.length === 1} onClick={() => ingredientFields.remove(index)}><Icon className="text-[18px]">close</Icon></button>
                      </div>
                      {selected ? <div className="mt-1.5 flex items-center justify-between text-xs text-[#475569]"><span>{selected.mermaPct > 0 ? `Merma ${formatPercent(selected.mermaPct)}` : unidadBaseShort[selected.unidadBase]} · Costo neto {formatMoney(selected.costoNetoReal)}/{unidadBaseShort[selected.unidadBase]}</span><strong className="font-mono text-[#0f172a]">{formatMoney(lineCost)}</strong></div> : null}
                    </div>
                  );
                })}
              </div>
              {form.formState.errors.ingredientes?.message ? <p className="text-xs text-[#b91c1c]">{form.formState.errors.ingredientes.message}</p> : null}
            </div>

            <div className="space-y-1.5 rounded-xl bg-[#f1f5f9] p-4 text-[13px] shadow-sm">
              <div className="flex items-center justify-between gap-2 pb-1"><span className="text-xs font-semibold uppercase tracking-wider text-[#475569]">Cálculo de Escandallo en Vivo</span>{foodCostLive !== null && liveGuidance && liveTone ? <span aria-live="polite" className={`rounded-full px-2 py-0.5 text-right text-xs font-semibold ${liveTone.bg} ${liveTone.text}`}>{liveGuidance.label} ({formatPercent(foodCostLive)})</span> : null}</div>
              <CostLine label="Costo Total Insumos Ficha:" value={formatMoney(costoMateriaPrima)} />
              <CostLine label="Costo Unitario por Porción:" value={formatMoney(livePricing?.costoPorPorcion ?? 0)} strong />
              <CostLine label={`Overhead Operativo (${formatPercent(config?.overheadPct ?? 0)}):`} value={formatMoney((livePricing?.costoPorPorcion ?? 0) * ((config?.overheadPct ?? 0) / 100))} />
              <div className="flex items-end justify-between border-t border-[#e2e8f0] pt-2"><span><strong className="block text-sm text-[#0f172a]">PVP Sugerido Final:</strong><small className="text-[11px] text-[#94a3b8]">Incluye impuesto y redondeo configurado</small></span><strong className="text-lg text-[#c25e19]">{formatMoney(livePricing?.precioSugeridoFinal ?? 0)}</strong></div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-[#475569]"><input type="checkbox" className="accent-[#c25e19]" {...form.register("borrador")} /> Guardar como borrador</label>
              <label className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-[#475569]"><input type="checkbox" className="accent-[#c25e19]" {...form.register("activa")} /> Receta activa</label>
            </div>
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] text-sm font-medium text-white shadow-sm transition hover:bg-[#475569] disabled:opacity-50" type="submit" disabled={form.formState.isSubmitting}><Icon className="text-[18px]">check_circle</Icon>{form.formState.isSubmitting ? "Guardando…" : "Guardar Receta Estandarizada"}</button>
          </form>
        </section>

        <div className="space-y-4 lg:col-span-7">
          <section className={`${card} space-y-4 p-6`}>
            <div className="flex flex-col justify-between gap-2 border-b border-[#e2e8f0] pb-2 sm:flex-row sm:items-center">
              <div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold tracking-tight text-[#0f172a]">Catálogo de Recetas Estandarizadas</h2><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-semibold text-[#475569]">{result.total} total</span></div><p className="text-[13px] text-[#475569]">Monitoreo de márgenes y semáforo de rentabilidad gastronómica.</p></div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado de rentabilidad">
                {catalogTabs.map(({ key, label }) => <button key={key} type="button" aria-pressed={tab === key} className={`min-h-8 rounded-full px-3 text-xs font-semibold transition ${tab === key ? "bg-[#0f172a] text-white shadow-sm" : key === "riesgo" ? "bg-[#fef2f2] text-[#b91c1c]" : key === "ajustar" ? "bg-[#fffbeb] text-[#b45309]" : key === "rentable" ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#f1f5f9] text-[#475569]"}`} onClick={() => { setTab(key); setPage(1); }}>{label}</button>)}
              </div>
            </div>

            {importReport ? <p className="rounded-lg bg-[#f1f5f9] p-3 text-xs text-[#475569]">Importadas: {importReport.creados}. Errores: {importReport.errores.length}{importReport.errores[0] ? ` · Fila ${importReport.errores[0].fila}: ${importReport.errores[0].motivo}` : ""}</p> : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
              <label className="relative sm:col-span-7"><span className="sr-only">Buscar recetas</span><Icon className="absolute left-3 top-2.5 text-[20px] text-[#94a3b8]">search</Icon><input className={`${softField} pl-9`} type="search" value={query} placeholder="Buscar por receta, ingrediente o SKU..." onChange={(event) => { setQuery(event.target.value); startTransition(() => setPage(1)); }} /></label>
              <label className="relative sm:col-span-5"><span className="sr-only">Filtrar por categoría</span><select className={`${softField} appearance-none pr-8`} value={categoria} onChange={(event) => { setCategoria(event.target.value as "" | CategoriaRecetaValue); setPage(1); }}><option value="">Todas las categorías</option>{categoriaRecetaValues.map((value) => <option key={value} value={value}>{categoriaRecetaLabels[value]}</option>)}</select><Icon className="pointer-events-none absolute right-2.5 top-2.5 text-[18px] text-[#94a3b8]">filter_list</Icon></label>
            </div>
            {filterInsumoId ? <div className="flex items-center justify-between rounded-lg bg-[#f1f5f9] p-3 text-sm"><span>Filtro por insumo aplicado</span><Link href="/recetas" className="font-semibold text-[#c25e19]">Quitar filtro</Link></div> : null}
            {loading ? <LoadingState message="Cargando recetas…" /> : null}
            {!loading && error ? <ErrorState message={error} onRetry={() => void loadCatalog()} /> : null}
            {!loading && !error && !result.items.length ? <EmptyState title="No hay recetas para mostrar" description="Ajusta los filtros o crea una ficha técnica." /> : null}
            {!loading && !error && result.items.length ? <div className="space-y-2">{result.items.map((receta) => <RecipeCard key={receta.id} receta={receta} impuestoPct={config?.impuestoPct ?? 0} foodCostCriticoPct={config?.foodCostCriticoPct ?? 35} duplicating={duplicatingId === receta.id} onDuplicate={() => void duplicate(receta.id)} onDelete={() => setDeleteConfirmId(receta.id)} />)}</div> : null}

            {!loading && !error && result.total > 0 ? <div className="flex flex-col items-center justify-between gap-2 border-t border-[#e2e8f0] pt-3 text-[13px] text-[#475569] sm:flex-row"><span>Mostrando <strong className="text-[#0f172a]">{result.items.length}</strong> de <strong className="text-[#0f172a]">{result.total}</strong> recetas estandarizadas</span><div className="flex gap-1"><PageButton icon="chevron_left" disabled={page <= 1} onClick={() => setPage(page - 1)} />{Array.from({ length: Math.min(totalPages, 3) }, (_, index) => Math.min(Math.max(page - 1, 1), Math.max(totalPages - 2, 1)) + index).filter((value) => value <= totalPages).map((value) => <button key={value} type="button" className={`h-8 w-8 rounded-lg text-xs font-semibold ${page === value ? "bg-[#0f172a] text-white" : "bg-[#f1f5f9] text-[#0f172a] hover:bg-[#e2e8f0]"}`} onClick={() => setPage(value)}>{value}</button>)}<PageButton icon="chevron_right" disabled={page >= totalPages} onClick={() => setPage(page + 1)} /></div></div> : null}
          </section>

          <aside className={`${card} flex items-start justify-between gap-4 border-l-4 border-l-[#c25e19] p-4`}>
            <div className="flex items-start gap-2"><Icon className="mt-0.5 text-[22px] text-[#c25e19]">insights</Icon><div><h3 className="text-sm font-bold text-[#0f172a]">Consejo de Ingeniería de Menú</h3><p className="mt-0.5 text-[13px] leading-5 text-[#475569]">{worst ? <><strong className="text-[#0f172a]">{worst.nombre}</strong> presenta el Food Cost más alto de esta vista ({formatPercent(worst.foodCostPct ?? 0)}). Revisa gramaje, merma o PVP para recuperar el margen objetivo.</> : <>Agrega PVP de carta para comparar Food Cost y detectar las recetas que necesitan ajuste.</>}</p></div></div>
            {worst ? <Link href={`/recetas/${worst.id}`} className="hidden h-9 shrink-0 items-center rounded-lg bg-[#c25e19] px-3 text-xs font-semibold text-white shadow-sm hover:bg-[#9a3412] sm:inline-flex">Revisar Escandallo</Link> : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, icon, value, suffix, badge, iconTone = "text-[#475569]", danger = false }: { title: string; icon: string; value: string; suffix?: string; badge: string; iconTone?: string; danger?: boolean }) {
  return <article className={`${card} flex min-h-[132px] flex-col justify-between p-4`}><div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#94a3b8]"><span>{title}</span><Icon className={`text-[20px] ${iconTone}`}>{icon}</Icon></div><p className={`mt-2 text-[30px] font-bold leading-9 tracking-[-0.03em] ${danger ? "text-[#b91c1c]" : "text-[#0f172a]"}`}>{value} {suffix ? <span className="text-sm font-normal tracking-normal text-[#475569]">{suffix}</span> : null}</p><span className={`mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${danger ? "bg-[#fffbeb] text-[#b45309]" : "bg-[#f0fdf4] text-[#15803d]"}`}>{badge}</span></article>;
}

function FormLabel({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="flex items-center justify-between text-sm font-medium text-[#0f172a]">{label}{hint ? <small className="text-xs font-normal text-[#94a3b8]">{hint}</small> : null}</span>{children}{error ? <span className="block text-xs text-[#b91c1c]">{error}</span> : null}</label>;
}

function CostLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between text-[#475569]"><span>{label}</span><span className={`font-mono text-[#0f172a] ${strong ? "font-bold" : "font-medium"}`}>{value}</span></div>;
}

function RecipeCard({ receta, impuestoPct, foodCostCriticoPct, duplicating, onDuplicate, onDelete }: { receta: RecetaCatalogoDTO; impuestoPct: number; foodCostCriticoPct: number; duplicating: boolean; onDuplicate: () => void; onDelete: () => void }) {
  const guidance = getRecipeProfitabilityGuidance({
    costoPorcion: receta.costoPorcion,
    pvpCarta: receta.pvpCarta,
    foodCostPct: receta.foodCostPct,
    impuestoPct,
    foodCostCriticoPct,
  });
  const tone = toneFor(guidance.kind);
  const copy = guidanceCopy(receta, guidance);
  return <article className="space-y-2 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition hover:bg-[#f8fafc]">
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-2"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone.bg}`}><Icon className={`text-[22px] ${tone.text}`}>{tone.icon}</Icon></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-semibold text-[#0f172a]">{receta.nombre}</h3><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone.bg} ${tone.text}`}><span className={`h-1.5 w-1.5 rounded-full ${tone.bar}`} />{guidance.label}</span>{receta.borrador ? <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-semibold text-[#64748b]">Borrador</span> : null}</div><p className="truncate text-[13px] text-[#475569]">{categoriaRecetaLabels[receta.categoria]} · {receta.rendimientoPorciones} {receta.rendimientoPorciones === 1 ? "porción" : "porciones"} · {receta.nInsumos} insumos{receta.tiempoPreparacionMin ? ` · ${receta.tiempoPreparacionMin} min preparación` : ""}</p></div></div>
      <div className="flex shrink-0 self-end sm:self-center"><Link aria-label="Editar escandallo" title="Editar escandallo" href={`/recetas/${receta.id}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"><Icon className="text-[18px]">edit</Icon></Link><button aria-label="Duplicar" title="Duplicar" type="button" disabled={duplicating} onClick={onDuplicate} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a] disabled:opacity-40"><Icon className="text-[18px]">content_copy</Icon></button><button aria-label="Eliminar" title="Eliminar" type="button" onClick={onDelete} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#475569] hover:bg-[#fef2f2] hover:text-[#b91c1c]"><Icon className="text-[18px]">delete</Icon></button></div>
    </div>
    <dl className="grid grid-cols-2 gap-2 rounded-lg border-t border-[#e2e8f0] bg-[#faf9f6] p-2.5 sm:grid-cols-4">
      <Metric label="Costo Porción" value={formatMoney(receta.costoPorcion)} />
      <Metric label="PVP Carta" value={receta.pvpCarta === null ? "—" : formatMoney(receta.pvpCarta)} />
      <Metric label="PVP Sugerido" value={formatMoney(receta.pvpSugerido)} accent />
      <div><dt className="text-[11px] font-semibold uppercase text-[#94a3b8]">Food Cost %</dt><dd className={`flex items-center gap-1.5 font-mono text-sm font-bold ${tone.text}`}><span>{receta.foodCostPct === null ? "—" : formatPercent(receta.foodCostPct)}</span><span aria-hidden="true" className={`h-1.5 w-12 overflow-hidden rounded-full ${tone.bg}`}><span className={`block h-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, receta.foodCostPct ?? 0))}%` }} /></span></dd></div>
    </dl>
    {guidance.kind !== "healthy" ? <div className={`flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center ${tone.bg} ${tone.border}`}><div className="flex min-w-0 items-start gap-2"><Icon className={`mt-0.5 text-[18px] ${tone.text}`}>{tone.icon}</Icon><div><p className={`text-xs font-bold ${tone.text}`}>{copy.headline}</p><p className="mt-0.5 text-xs leading-5 text-[#475569]">{copy.detail}</p></div></div><Link href={`/recetas/${receta.id}`} className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-white px-3 text-xs font-semibold shadow-sm transition hover:shadow ${tone.text}`}>{copy.cta}<Icon className="text-[16px]">arrow_forward</Icon></Link></div> : null}
  </article>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div><dt className="text-[11px] font-semibold uppercase text-[#94a3b8]">{label}</dt><dd className={`font-mono text-sm font-bold ${accent ? "text-[#c25e19]" : "text-[#0f172a]"}`}>{value}</dd></div>;
}

function PageButton({ icon, disabled, onClick }: { icon: string; disabled: boolean; onClick: () => void }) {
  return <button aria-label={icon === "chevron_left" ? "Página anterior" : "Página siguiente"} type="button" disabled={disabled} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#0f172a] hover:bg-[#e2e8f0] disabled:cursor-not-allowed disabled:text-[#94a3b8]"><Icon className="text-[18px]">{icon}</Icon></button>;
}
