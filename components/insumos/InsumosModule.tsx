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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type {
  InsumoDTO,
  InsumosResumenDTO,
  PaginatedResponse,
  ProveedorDTO,
} from "@/lib/api-types";
import {
  categoriaInsumoLabels,
  categoriaInsumoValues,
  unidadBaseLabels,
  unidadBaseShort,
  unidadBaseValues,
  type CategoriaInsumoValue,
  type UnidadBaseValue,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import {
  calculateUnitCostFromPurchase,
  calculateWasteCost,
  calculateYieldPct,
} from "@/lib/unit-conversion";
import { insumoSchema } from "@/lib/validation";
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

type FormValues = z.input<typeof insumoSchema>;
type ImportReport = { creados: number; errores: Array<{ fila: number; motivo: string }> };

const PAGE_SIZE = 8;
const defaultValues: FormValues = {
  nombre: "",
  categoria: "ABARROTES_SECOS",
  unidadBase: "GRAMO",
  costoUnidad: 0,
  mermaPct: 0,
  presentacionCantidad: null,
  presentacionUnidad: null,
  precioPresentacion: null,
  proveedorPreferidoId: "",
  activo: true,
};

function presentationLabel(insumo: InsumoDTO) {
  if (
    insumo.presentacionCantidad === null ||
    insumo.presentacionUnidad === null ||
    insumo.precioPresentacion === null
  ) {
    return `Costo base por ${unidadBaseShort[insumo.unidadBase]}`;
  }
  return `${formatMoney(insumo.precioPresentacion)} / ${insumo.presentacionCantidad} ${unidadBaseShort[insumo.presentacionUnidad]}`;
}

function MaterialIcon({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden>{children}</span>;
}

function categoryIcon(categoria: CategoriaInsumoValue) {
  const icons: Record<CategoriaInsumoValue, string> = {
    PROTEINAS_CARNES: "set_meal",
    LACTEOS_QUESOS: "egg_alt",
    FRUTAS_VERDURAS: "nutrition",
    ABARROTES_SECOS: "grocery",
    EMPAQUES_DESECHABLES: "inventory",
    BEBIDAS_LICORES: "local_bar",
  };
  return icons[categoria];
}

function visiblePages(page: number, totalPages: number) {
  return [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);
}

export function InsumosModule() {
  const [result, setResult] = useState<PaginatedResponse<InsumoDTO>>({
    items: [], total: 0, page: 1, pageSize: PAGE_SIZE,
  });
  const [resumen, setResumen] = useState<InsumosResumenDTO | null>(null);
  const [proveedores, setProveedores] = useState<ProveedorDTO[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [categoria, setCategoria] = useState<"" | CategoriaInsumoValue>("");
  const [proveedorId, setProveedorId] = useState("");
  const [precioCompra, setPrecioCompra] = useState(0);
  const [cantidadCompra, setCantidadCompra] = useState(1);
  const [unidadCompra, setUnidadCompra] = useState<UnidadBaseValue>("KILOGRAMO");
  const [calcError, setCalcError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogViewKey = `${page}\u0000${deferredQuery}\u0000${categoria}\u0000${proveedorId}`;
  const catalogViewKeyRef = useRef(catalogViewKey);
  const pendingDeletesRef = useRef(new Map<string, string>());

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(insumoSchema), defaultValues });
  const unidadBase = watch("unidadBase");
  const costoUnidad = Number(watch("costoUnidad")) || 0;
  const mermaPct = Number(watch("mermaPct")) || 0;
  const rendimientoPct = mermaPct >= 0 && mermaPct < 100 ? calculateYieldPct(mermaPct) : 0;
  const costoNeto = costoUnidad > 0 && mermaPct < 100
    ? calculateWasteCost(costoUnidad, mermaPct)
    : 0;

  async function loadCatalog(signal?: AbortSignal) {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (deferredQuery) params.set("q", deferredQuery);
    if (categoria) params.set("categoria", categoria);
    if (proveedorId) params.set("proveedorId", proveedorId);
    try {
      const response = await fetch(`/api/insumos?${params}`, { signal });
      if (!response.ok) throw new Error("No se pudo cargar el catálogo de insumos.");
      const data: PaginatedResponse<InsumoDTO> = await response.json();
      if (catalogViewKeyRef.current !== catalogViewKey) return;
      const pendingIds = new Set(
        [...pendingDeletesRef.current].filter(([, viewKey]) => viewKey === catalogViewKey).map(([id]) => id),
      );
      setResult(omitPendingDeletes(data, pendingIds));
    } catch (loadError) {
      if ((loadError as Error).name !== "AbortError") {
        setError(loadError instanceof Error ? loadError.message : "Error inesperado");
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }

  async function loadSummary() {
    const response = await fetch("/api/insumos/resumen");
    if (!response.ok) return;
    setResumen(await response.json());
  }

  async function loadSummaryAndSuppliers() {
    const [summaryResponse, suppliersResponse] = await Promise.all([
      fetch("/api/insumos/resumen"),
      fetch("/api/proveedores?activo=true&pageSize=100"),
    ]);
    if (!summaryResponse.ok || !suppliersResponse.ok) return;
    const [summary, suppliers]: [InsumosResumenDTO, ProveedorDTO[]] = await Promise.all([
      summaryResponse.json(), suppliersResponse.json(),
    ]);
    setResumen(summary);
    setProveedores(suppliers);
  }

  const loadCatalogEffect = useEffectEvent(loadCatalog);

  useLayoutEffect(() => {
    catalogViewKeyRef.current = catalogViewKey;
  }, [catalogViewKey]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalogEffect(controller.signal);
    return () => controller.abort();
  }, [page, deferredQuery, categoria, proveedorId]);

  useEffect(() => {
    void loadSummaryAndSuppliers();
  }, []);

  function clearForm() {
    setEditingId(null);
    reset(defaultValues);
    setPrecioCompra(0);
    setCantidadCompra(1);
    setUnidadCompra("KILOGRAMO");
    setCalcError(null);
  }

  async function onSubmit(values: FormValues) {
    const response = await fetch(editingId ? `/api/insumos/${editingId}` : "/api/insumos", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo guardar el insumo.");
    }
    clearForm();
    await Promise.all([loadCatalog(), loadSummaryAndSuppliers()]);
    toast.success(editingId ? "Insumo actualizado" : "Insumo creado");
  }

  function startEdit(insumo: InsumoDTO) {
    setEditingId(insumo.id);
    reset({
      nombre: insumo.nombre,
      categoria: insumo.categoria,
      unidadBase: insumo.unidadBase,
      costoUnidad: insumo.costoUnidad,
      mermaPct: insumo.mermaPct,
      presentacionCantidad: insumo.presentacionCantidad,
      presentacionUnidad: insumo.presentacionUnidad,
      precioPresentacion: insumo.precioPresentacion,
      proveedorPreferidoId: insumo.proveedorPreferidoId ?? "",
      activo: insumo.activo,
    });
    setPrecioCompra(insumo.precioPresentacion ?? 0);
    setCantidadCompra(insumo.presentacionCantidad ?? 1);
    setUnidadCompra(insumo.presentacionUnidad ?? insumo.unidadBase);
    setCalcError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function calculatePurchaseCost() {
    const cost = calculateUnitCostFromPurchase({
      precioCompra,
      cantidadCompra,
      unidadCompra,
      unidadBase,
    });
    if (cost === null) {
      setCalcError("Verifica que las cantidades sean positivas y las unidades compatibles.");
      return;
    }
    setCalcError(null);
    setValue("costoUnidad", Number(cost.toFixed(4)), { shouldValidate: true });
    setValue("presentacionCantidad", cantidadCompra, { shouldValidate: true });
    setValue("presentacionUnidad", unidadCompra, { shouldValidate: true });
    setValue("precioPresentacion", precioCompra, { shouldValidate: true });
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return;

    const deletedId = deleteConfirmId;
    const deletion = removeOptimistically(result, deletedId);
    if (!deletion.snapshot) {
      setDeleteConfirmId(null);
      return;
    }
    const deletedPage = page;
    const deletedViewKey = catalogViewKey;
    const wasOnlyVisibleItem = result.items.length === 1;

    setDeleteConfirmId(null);
    pendingDeletesRef.current.set(deletedId, deletedViewKey);
    setResult((current) => removeOptimistically(current, deletedId).next);

    try {
      const response = await fetch(`/api/insumos/${deletedId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudo eliminar el insumo.");
      }
    } catch (deleteError) {
      pendingDeletesRef.current.delete(deletedId);
      if (catalogViewKeyRef.current === deletedViewKey) {
        setResult((current) => restoreOptimistically(current, deletion.snapshot!));
      }
      toast.error(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el insumo.");
      return;
    }

    if (wasOnlyVisibleItem && deletedPage > 1 && catalogViewKeyRef.current === deletedViewKey) {
      setPage(deletedPage - 1);
    }
    await loadSummary().catch(() => undefined);
    toast.success("Insumo eliminado");
  }

  async function importCsv(file: File) {
    const data = new FormData();
    data.set("archivo", file);
    const response = await fetch("/api/insumos/importar", { method: "POST", body: data });
    const report = await response.json();
    if (!response.ok) {
      toast.error(report.message ?? "No se pudo importar el CSV.");
      return;
    }
    setImportReport(report);
    await Promise.all([loadCatalog(), loadSummaryAndSuppliers()]);
    toast.success(`${report.creados} insumo${report.creados === 1 ? "" : "s"} importado${report.creados === 1 ? "" : "s"}`);
  }

  const insumoToDelete = result.items.find((item) => item.id === deleteConfirmId);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageFrom = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const pageTo = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={deleteConfirmId !== null}
        title="Eliminar insumo"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteConfirmId(null)}
      >
        {insumoToDelete ? <p>Se eliminará <strong>{insumoToDelete.nombre}</strong>.</p> : null}
      </ConfirmModal>

      <div className="flex flex-wrap gap-2 xl:absolute xl:right-6 xl:top-5 xl:z-20">
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          aria-label="Seleccionar archivo CSV de insumos"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importCsv(file);
            event.target.value = "";
          }}
        />
        <button
          data-tour="insumos-importar"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[#0f172a] shadow-sm transition-colors hover:bg-[#f1f5f9]"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          <MaterialIcon className="text-[18px] text-[#475569]">file_upload</MaterialIcon>
          Importar CSV
        </button>
        <button
          data-tour="insumos-crear"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-white shadow transition-colors hover:bg-[#475569]"
          type="button"
          onClick={clearForm}
        >
          <MaterialIcon className="text-[18px]">add_circle</MaterialIcon>
          Nuevo Insumo
        </button>
      </div>

      <aside className="rounded-xl bg-[#f0f9ff] p-4 shadow-sm" aria-labelledby="merma-callout-title">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0369a1]/10 text-[#0369a1]">
              <MaterialIcon className="text-[22px]">lightbulb</MaterialIcon>
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-white/80 px-2 py-0.5 text-xs font-semibold text-[#0369a1]">CONCEPTO CLAVE DE COSTEO</span>
                <h2 id="merma-callout-title" className="text-lg font-bold leading-7 tracking-[-0.015em] text-[#0f172a]">¿Por qué tipificar la Merma en cada Insumo?</h2>
              </div>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-[#475569]">
                El peso bruto que compras en factura casi nunca es el peso neto que llega al plato. El sistema aplica <strong>Costo Neto = Costo Bruto / (1 - % Merma)</strong> para evitar subestimar el costo real de tus recetas.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 self-end lg:self-center">
            <div className="hidden flex-col items-end text-right xl:flex">
              <span className="text-xs font-semibold tracking-[0.02em] text-[#94a3b8]">Fórmula estándar</span>
              <code className="mt-1 rounded bg-white px-2 py-1 text-xs font-semibold text-[#0369a1]">Costo Neto = Costo Bruto / (1 - %Merma)</code>
            </div>
            <Link href="/glosario" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#0369a1] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#075985]">
              <MaterialIcon className="text-[16px]">menu_book</MaterialIcon>
              Ver Guía Completa
            </Link>
          </div>
        </div>
      </aside>

      {importReport ? (
        <section className="rounded-xl border border-[#bae6fd] bg-white p-4 text-sm" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-primary">Importación: {importReport.creados} creados, {importReport.errores.length} errores</p>
            <button className="btn-ghost" type="button" onClick={() => setImportReport(null)}>Cerrar</button>
          </div>
          {importReport.errores.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[var(--danger-text)]">
              {importReport.errores.map((item) => <li key={`${item.fila}-${item.motivo}`}>Fila {item.fila}: {item.motivo}</li>)}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-5">
        <form
            className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-6"
            onSubmit={handleSubmit(async (values) => {
              try { await onSubmit(values); }
              catch (submitError) { toast.error(submitError instanceof Error ? submitError.message : "Error inesperado"); }
            })}
          >
            <div className="flex flex-col justify-between gap-4 border-b border-[#e2e8f0] pb-3 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#c25e19]"><MaterialIcon className="text-[20px]">edit_note</MaterialIcon></span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold leading-7 tracking-[-0.015em] text-[#0f172a]">{editingId ? "Editar Insumo" : "Registrar Insumo"}</h2>
                    <span className="rounded bg-[#f1f5f9] px-2 py-0.5 text-xs font-semibold text-[#475569]">{editingId ? "Edición" : "Nuevo"}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-[#94a3b8]">Parámetros base, merma y prorrateo contable</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                <label className="mr-1 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#475569]">
                  <input type="checkbox" className="h-4 w-4 accent-[#c25e19]" {...register("activo")} /> Activo
                </label>
                <button className="min-h-11 rounded-lg bg-[#f1f5f9] px-4 text-sm font-medium text-[#475569] transition-colors hover:bg-[#e2e8f0] hover:text-[#0f172a]" type="button" onClick={clearForm}>Limpiar</button>
                <button className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-[#c25e19] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9a3412] disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <MaterialIcon className="text-[18px]">save</MaterialIcon>}
                  {isSubmitting ? "Guardando..." : editingId ? "Guardar Cambios" : "Guardar Insumo"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <label htmlFor="insumo-nombre" className="mb-1 block text-sm font-medium text-[#0f172a]">Nombre del Insumo <span className="text-[#c25e19]">*</span></label>
                <div className="relative">
                  <input id="insumo-nombre" className="h-11 w-full rounded-lg border-0 bg-[#f1f5f9] px-3 pr-10 text-sm text-[#0f172a] outline-none transition-shadow focus:bg-white focus:ring-2 focus:ring-[#c25e19]/20" placeholder="Ej. Pechuga de pollo, mantequilla..." aria-invalid={!!errors.nombre} {...register("nombre")} />
                  <MaterialIcon className="pointer-events-none absolute right-3 top-3 text-[18px] text-[#94a3b8]">restaurant</MaterialIcon>
                </div>
                {errors.nombre ? <p className="mt-1 text-xs font-medium text-[#b91c1c]" role="alert">{errors.nombre.message}</p> : null}
              </div>

              <div className="lg:col-span-3">
                <label htmlFor="insumo-categoria" className="mb-1 block text-sm font-medium text-[#0f172a]">Categoría</label>
                <select id="insumo-categoria" className="h-11 w-full rounded-lg border-0 bg-[#f1f5f9] px-3 text-sm text-[#0f172a] outline-none focus:bg-white focus:ring-2 focus:ring-[#c25e19]/20" {...register("categoria")}>
                  {categoriaInsumoValues.map((value) => <option key={value} value={value}>{categoriaInsumoLabels[value]}</option>)}
                </select>
                {errors.categoria ? <p className="mt-1 text-xs text-[#b91c1c]">{errors.categoria.message}</p> : null}
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="insumo-unidad" className="mb-1 block text-sm font-medium text-[#0f172a]">Unidad Base Receta</label>
                <select id="insumo-unidad" className="h-11 w-full rounded-lg border-0 bg-[#f1f5f9] px-3 text-sm text-[#0f172a] outline-none focus:bg-white focus:ring-2 focus:ring-[#c25e19]/20" {...register("unidadBase")}>
                  {unidadBaseValues.map((value) => <option key={value} value={value}>{unidadBaseLabels[value]}</option>)}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="insumo-proveedor" className="mb-1 block text-sm font-medium text-[#0f172a]">Proveedor Habitual</label>
                <div className="relative">
                  <select id="insumo-proveedor" className="h-11 w-full appearance-none rounded-lg border-0 bg-[#f1f5f9] px-3 pr-10 text-sm text-[#0f172a] outline-none focus:bg-white focus:ring-2 focus:ring-[#c25e19]/20" {...register("proveedorPreferidoId")}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.codigo} · {supplier.nombre}</option>)}
                  </select>
                  <MaterialIcon className="pointer-events-none absolute right-3 top-3 text-[18px] text-[#94a3b8]">local_shipping</MaterialIcon>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
              <section className="flex flex-col justify-between rounded-xl bg-[#f1f5f9] p-4 shadow-inner lg:col-span-5" aria-labelledby="purchase-calculator-title">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 id="purchase-calculator-title" className="flex items-center gap-1.5 text-sm font-bold text-[#0f172a]"><MaterialIcon className="text-[18px] text-[#c25e19]">calculate</MaterialIcon>Calculadora de Compra a Unidad</h3>
                  <span className="text-xs font-semibold text-[#94a3b8]">Prorrateo Rápido</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#475569]">Ingresa los datos de factura para convertir kilos, cajas o litros a tu costo unitario base.</p>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="text-xs font-medium text-[#64748b]">Precio Compra ($)
                    <input className="mt-1 h-10 w-full rounded bg-white px-2.5 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#c25e19]/20" type="number" min="0" step="0.01" value={precioCompra} onChange={(event) => setPrecioCompra(Number(event.target.value))} />
                  </label>
                  <label className="text-xs font-medium text-[#64748b]">Cantidad
                    <input className="mt-1 h-10 w-full rounded bg-white px-2.5 text-sm text-[#0f172a] outline-none focus:ring-2 focus:ring-[#c25e19]/20" type="number" min="0" step="0.0001" value={cantidadCompra} onChange={(event) => setCantidadCompra(Number(event.target.value))} />
                  </label>
                  <label className="text-xs font-medium text-[#64748b]">Presentación
                    <select className="mt-1 h-10 w-full rounded bg-white px-2.5 text-sm text-[#0f172a] outline-none focus:ring-2 focus:ring-[#c25e19]/20" value={unidadCompra} onChange={(event) => setUnidadCompra(event.target.value as UnidadBaseValue)}>
                      {unidadBaseValues.map((value) => <option key={value} value={value}>{unidadBaseLabels[value]}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#e2e8f0] pt-3 text-xs">
                  <span className="font-semibold text-[#94a3b8]">Costo Base Bruto:</span>
                  <span className="font-mono font-bold text-[#0f172a]">{formatMoney(costoUnidad)} / {unidadBaseShort[unidadBase]}</span>
                </div>
                <button className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded bg-white px-3 text-xs font-semibold text-[#0f172a] shadow-sm transition-colors hover:text-[#c25e19]" type="button" onClick={calculatePurchaseCost}>
                  <MaterialIcon className="text-[16px] text-[#c25e19]">sync_alt</MaterialIcon>Actualizar Costo Base
                </button>
                {calcError ? <p className="mt-2 text-xs text-[#b91c1c]" role="alert">{calcError}</p> : null}
                {errors.costoUnidad ? <p className="mt-2 text-xs text-[#b91c1c]" role="alert">Define un costo base válido con la calculadora.</p> : null}
              </section>

              <input type="hidden" {...register("costoUnidad", { valueAsNumber: true })} />

              <section className="flex flex-col justify-between rounded-xl bg-[#faf9f6] p-4 lg:col-span-4" aria-labelledby="waste-factor-title">
                <div className="flex items-center justify-between gap-3">
                  <label id="waste-factor-title" className="flex items-center gap-1.5 text-sm font-medium text-[#0f172a]" htmlFor="mermaPct">Factor de Merma Operativa <MaterialIcon className="text-[16px] text-[#b45309]">warning</MaterialIcon></label>
                  <div className="flex items-center gap-1">
                    <input className="h-8 w-14 rounded bg-white text-center text-sm font-bold text-[#b45309] outline-none" type="number" min="0" max="99" step="0.5" value={mermaPct} onChange={(event) => setValue("mermaPct", Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0, { shouldValidate: true })} aria-label="Porcentaje de merma" />
                    <span className="text-sm font-bold text-[#0f172a]">%</span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#94a3b8]">Pérdida estimada por limpieza, hueso, evaporación o pelado.</p>
                <input id="mermaPct" className="mt-3 w-full cursor-pointer accent-[#c25e19]" type="range" min="0" max="99" step="0.5" {...register("mermaPct", { valueAsNumber: true })} />
                <div className="mt-1 flex justify-between text-[11px] text-[#94a3b8]"><span>0% sin desecho</span><span>15% habitual</span><span>40%+ alto</span></div>
                <div className="mt-3 flex items-center justify-between border-t border-[#e2e8f0] pt-3 text-xs">
                  <span className="text-[#475569]">Rendimiento neto:</span>
                  <strong className="text-[#15803d]">{rendimientoPct.toFixed(1)}% de aprovechamiento</strong>
                </div>
                {errors.mermaPct ? <p className="mt-1 text-xs text-[#b91c1c]">{errors.mermaPct.message}</p> : null}
              </section>

              <section className="flex min-h-[190px] flex-col justify-between rounded-xl bg-gradient-to-br from-[#f1f5f9] to-[#ffdbca]/30 p-4 lg:col-span-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#475569]">Costo Real Ajustado</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f0fdf4] px-2 py-0.5 text-[11px] font-bold text-[#15803d]"><span className="h-1.5 w-1.5 rounded-full bg-[#15803d]" />Rinde {rendimientoPct.toFixed(0)}%</span>
                </div>
                <div>
                  <p className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.03em] text-[#c25e19]">{formatMoney(costoNeto)}</p>
                  <p className="text-sm font-medium text-[#475569]">por {unidadBaseShort[unidadBase]} neto</p>
                </div>
                <p className="text-[11px] leading-4 text-[#94a3b8]">* Se inyecta directamente en recetas con este insumo.</p>
              </section>
            </div>
          </form>

        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <div><p className="text-xs font-semibold uppercase tracking-[0.02em] text-[#94a3b8]">Insumos Activos</p><p className="mt-0.5 text-[30px] font-bold leading-9 tracking-[-0.03em] text-[#0f172a]">{resumen?.activos ?? "—"}</p><p className="mt-0.5 flex items-center gap-0.5 text-xs text-[#15803d]"><MaterialIcon className="text-[14px]">check_circle</MaterialIcon>Disponibles para costeo</p></div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#0f172a]"><MaterialIcon className="text-[20px]">shelves</MaterialIcon></span>
            </article>
            <article className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <div><p className="text-xs font-semibold uppercase tracking-[0.02em] text-[#94a3b8]">Promedio de Merma</p><p className="mt-0.5 text-[30px] font-bold leading-9 tracking-[-0.03em] text-[#b45309]">{resumen ? `${resumen.mermaPromedioPct.toFixed(1)}%` : "—"}</p><p className="mt-0.5 text-xs text-[#94a3b8]">Promedio del catálogo</p></div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fffbeb] text-[#b45309]"><MaterialIcon className="text-[20px]">pie_chart</MaterialIcon></span>
            </article>
            <article className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <div><p className="text-xs font-semibold uppercase tracking-[0.02em] text-[#94a3b8]">Proveedores Activos</p><p className="mt-0.5 text-[30px] font-bold leading-9 tracking-[-0.03em] text-[#0f172a]">{resumen?.proveedoresActivos ?? "—"}</p><p className="mt-0.5 text-xs text-[#475569]">{resumen ? `${resumen.proveedoresConVariacion} con variación de precio` : "Cargando resumen"}</p></div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f0f9ff] text-[#0369a1]"><MaterialIcon className="text-[20px]">storefront</MaterialIcon></span>
            </article>
          </div>

          <section className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-3 border-b border-[#e2e8f0] p-4 xl:grid-cols-[minmax(180px,1fr)_180px_180px]">
              <label className="relative">
                <span className="sr-only">Buscar insumos</span>
                <MaterialIcon className="pointer-events-none absolute left-3 top-3 text-[18px] text-[#94a3b8]">search</MaterialIcon>
                <input className="h-11 w-full rounded-lg border-0 bg-[#f1f5f9] pl-10 pr-3 text-sm text-[#0f172a] outline-none focus:bg-white focus:ring-2 focus:ring-[#c25e19]/20" type="search" value={query} placeholder="Buscar por nombre o código..." onChange={(event) => { setQuery(event.target.value); startTransition(() => setPage(1)); }} />
              </label>
              <select aria-label="Filtrar por categoría" className="h-11 rounded-lg border-0 bg-[#f1f5f9] px-3 text-sm text-[#475569] outline-none focus:bg-white focus:ring-2 focus:ring-[#c25e19]/20" value={categoria} onChange={(event) => { setCategoria(event.target.value as "" | CategoriaInsumoValue); setPage(1); }}>
                <option value="">Todas las categorías</option>{categoriaInsumoValues.map((value) => <option key={value} value={value}>{categoriaInsumoLabels[value]}</option>)}
              </select>
              <select aria-label="Filtrar por proveedor" className="h-11 rounded-lg border-0 bg-[#f1f5f9] px-3 text-sm text-[#475569] outline-none focus:bg-white focus:ring-2 focus:ring-[#c25e19]/20" value={proveedorId} onChange={(event) => { setProveedorId(event.target.value); setPage(1); }}>
                <option value="">Todos los proveedores</option>{proveedores.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.nombre}</option>)}
              </select>
            </div>

            {error ? <ErrorState message={error} onRetry={() => void loadCatalog()} /> : null}
            {isLoading ? <LoadingState message="Cargando insumos..." /> : null}
            {!isLoading && !error && result.items.length === 0 ? <EmptyState title="No hay insumos para mostrar" description="Ajusta los filtros o registra el primer insumo del catálogo." /> : null}

            {!isLoading && !error && result.items.length > 0 ? (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                    <thead className="border-b border-[#e2e8f0] bg-[#f1f5f9]/70 text-[11px] uppercase tracking-[0.08em] text-[#94a3b8]">
                      <tr><th className="px-4 py-3">Insumo y categoría</th><th className="px-4 py-3">Presentación y proveedor</th><th className="px-4 py-3 text-center">Recetas vinculadas</th><th className="px-4 py-3 text-center">Factor de merma</th><th className="px-4 py-3 text-right">Costo neto real</th><th className="px-4 py-3 text-right">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      {result.items.map((insumo) => (
                        <tr key={insumo.id} className={`group transition-colors hover:bg-[#f1f5f9]/50 ${!insumo.activo ? "opacity-60" : ""}`}>
                          <td className="px-4 py-3.5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#c25e19]/10 text-[#c25e19]"><MaterialIcon className="text-[20px]">{categoryIcon(insumo.categoria)}</MaterialIcon></span><div><p className="text-[15px] font-bold text-[#0f172a] transition-colors group-hover:text-[#c25e19]">{insumo.nombre}</p><div className="mt-0.5 flex flex-wrap items-center gap-1.5"><span className="rounded bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-semibold text-[#475569]">{categoriaInsumoLabels[insumo.categoria]}</span><span className="font-mono text-[11px] text-[#94a3b8]">{insumo.codigo}</span></div></div></div></td>
                          <td className="px-4 py-3.5"><p className="font-medium text-[#0f172a]">{presentationLabel(insumo)}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-[#94a3b8]"><MaterialIcon className="text-[13px]">local_shipping</MaterialIcon>{insumo.proveedorPreferido?.nombre ?? "Sin proveedor habitual"}</p></td>
                          <td className="px-4 py-3.5 text-center"><Link className="inline-flex items-center gap-1 rounded-full bg-[#ffdbca]/40 px-2.5 py-1 text-xs font-medium text-[#c25e19]" href={`/recetas?insumoId=${insumo.id}`}><MaterialIcon className="text-[13px]">menu_book</MaterialIcon>{insumo.recetasVinculadas} recetas</Link></td>
                          <td className="px-4 py-3.5 text-center"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${insumo.mermaPct > 0 ? "bg-[#fffbeb] text-[#b45309]" : "bg-[#f0fdf4] text-[#15803d]"}`}>{insumo.mermaPct}% merma</span><p className="mt-0.5 text-[11px] text-[#94a3b8]">Rendimiento {insumo.rendimientoPct}%</p></td>
                          <td className="px-4 py-3.5 text-right"><p className="whitespace-nowrap font-mono text-base font-bold text-[#0f172a]">{formatMoney(insumo.costoNetoReal)} <span className="text-xs font-normal text-[#94a3b8]">/ {unidadBaseShort[insumo.unidadBase]}</span></p><p className={`mt-0.5 text-[11px] font-medium ${insumo.mermaPct > 0 ? "text-[#c25e19]" : "text-[#94a3b8]"}`}>{insumo.mermaPct > 0 ? "Ajustado con merma" : "Costo directo"}</p></td>
                          <td className="px-4 py-3.5"><div className="flex justify-end gap-1"><button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#f1f5f9] hover:text-[#c25e19]" type="button" title="Editar insumo" aria-label={`Editar ${insumo.nombre}`} onClick={() => startEdit(insumo)}><MaterialIcon className="text-[18px]">edit</MaterialIcon></button><button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#fef2f2] hover:text-[#b91c1c]" type="button" title="Eliminar insumo" aria-label={`Eliminar ${insumo.nombre}`} onClick={() => setDeleteConfirmId(insumo.id)}><MaterialIcon className="text-[18px]">delete</MaterialIcon></button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-[#e2e8f0] md:hidden">
                  {result.items.map((insumo) => (
                    <article key={insumo.id} className="p-4">
                      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#0f172a]">{insumo.nombre}</p><p className="mt-1 font-mono text-xs text-[#94a3b8]">{insumo.codigo}</p></div><span className="rounded bg-[#fffbeb] px-2 py-1 text-xs text-[#b45309]">{insumo.mermaPct}% merma</span></div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-[#94a3b8]">Categoría</dt><dd className="mt-1 text-[#0f172a]">{categoriaInsumoLabels[insumo.categoria]}</dd></div><div><dt className="text-[#94a3b8]">Costo neto</dt><dd className="mt-1 font-mono font-bold text-[#0f172a]">{formatMoney(insumo.costoNetoReal)} / {unidadBaseShort[insumo.unidadBase]}</dd></div><div><dt className="text-[#94a3b8]">Proveedor</dt><dd className="mt-1 text-[#0f172a]">{insumo.proveedorPreferido?.nombre ?? "Sin proveedor"}</dd></div><div><dt className="text-[#94a3b8]">Recetas</dt><dd className="mt-1 text-[#0f172a]">{insumo.recetasVinculadas}</dd></div></dl>
                      <div className="mt-4 flex gap-2"><button className="btn-secondary flex-1" type="button" onClick={() => startEdit(insumo)}>Editar</button><button className="btn-danger" type="button" onClick={() => setDeleteConfirmId(insumo.id)}>Eliminar</button></div>
                    </article>
                  ))}
                </div>
                <nav className="flex flex-col items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-3 sm:flex-row" aria-label="Paginación">
                  <p className="text-xs text-[#94a3b8]" aria-live="polite">Mostrando <strong className="text-[#0f172a]">{pageFrom} a {pageTo}</strong> de <strong className="text-[#0f172a]">{result.total}</strong> insumos registrados</p>
                  <div className="flex items-center gap-1">
                    <button className="flex h-8 w-8 items-center justify-center rounded bg-[#f1f5f9] text-[#475569] transition-colors hover:bg-[#eceef0] disabled:text-[#94a3b8]" type="button" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)} aria-label="Página anterior"><MaterialIcon className="text-[18px]">chevron_left</MaterialIcon></button>
                    {visiblePages(result.page, totalPages).map((item, index, pages) => (
                      <span key={item} className="contents">
                        {index > 0 && item - pages[index - 1]! > 1 ? <span className="px-1 text-xs text-[#94a3b8]">...</span> : null}
                        <button className={`flex h-8 w-8 items-center justify-center rounded text-xs font-semibold transition-colors ${item === result.page ? "bg-[#0f172a] text-white" : "bg-[#f1f5f9] text-[#475569] hover:bg-[#eceef0]"}`} type="button" onClick={() => setPage(item)} aria-current={item === result.page ? "page" : undefined}>{item}</button>
                      </span>
                    ))}
                    <button className="flex h-8 w-8 items-center justify-center rounded bg-[#f1f5f9] text-[#475569] transition-colors hover:bg-[#eceef0] disabled:text-[#94a3b8]" type="button" disabled={result.page >= totalPages} onClick={() => setPage(result.page + 1)} aria-label="Página siguiente"><MaterialIcon className="text-[18px]">chevron_right</MaterialIcon></button>
                  </div>
                </nav>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
