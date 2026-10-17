"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import type {
  ComprasResumenDTO,
  FacturaCompraDTO,
  InsumoDTO,
  PaginatedResponse,
  ProveedorDTO,
  VariacionPrecioDTO,
} from "@/lib/api-types";
import { condicionPagoLabels, unidadBaseLabels, unidadBaseValues } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { facturaCompraSchema } from "@/lib/validation";
import {
  omitPendingDeletes,
  removeOptimistically,
  restoreOptimistically,
} from "@/lib/optimistic-delete";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Tooltip } from "@/components/ui/Tooltip";

type FormValues = z.input<typeof facturaCompraSchema>;

const emptyLine = {
  insumoId: "",
  cantidad: 1,
  unidad: "KILOGRAMO" as const,
  precioUnitarioBruto: 0,
  tasaImpuestoPct: 19 as const,
};

function defaults(): FormValues {
  return {
    proveedorId: "",
    tipo: "FAC",
    numero: "",
    fechaEmision: new Date().toISOString().slice(0, 10),
    condicionPago: "CONTADO",
    actualizaCostos: true,
    aplicar: false,
    lineas: [{ ...emptyLine }],
  };
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { message?: string }).message ?? fallback);
  return body as T;
}

export function ComprasInsumosModule() {
  const searchParams = useSearchParams();
  const requestedInsumoId = searchParams.get("insumoId");
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorDTO[]>([]);
  const [facturas, setFacturas] = useState<PaginatedResponse<FacturaCompraDTO>>({
    items: [], total: 0, page: 1, pageSize: 8,
  });
  const [resumen, setResumen] = useState<ComprasResumenDTO | null>(null);
  const [variaciones, setVariaciones] = useState<VariacionPrecioDTO[]>([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [proveedorFiltro, setProveedorFiltro] = useState("");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const [facturaAEliminar, setFacturaAEliminar] = useState<FacturaCompraDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const purchasesViewKey = `${page}\u0000${q}\u0000${proveedorFiltro}\u0000${mes}`;
  const purchasesViewKeyRef = useRef(purchasesViewKey);
  const pendingDeletesRef = useRef(new Map<string, string>());
  const loadInvoicePageOnlyRef = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(facturaCompraSchema),
    defaultValues: defaults(),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineas" });
  const lineas = useWatch({ control: form.control, name: "lineas" }) ?? [];
  const condicion = useWatch({ control: form.control, name: "condicionPago" });
  const fechaEmision = useWatch({ control: form.control, name: "fechaEmision" });
  const subtotal = lineas.reduce(
    (sum, linea) => sum + (Number(linea.cantidad) || 0) * (Number(linea.precioUnitarioBruto) || 0), 0,
  );
  const impuestos = lineas.reduce(
    (sum, linea) => sum + (Number(linea.cantidad) || 0) * (Number(linea.precioUnitarioBruto) || 0) * ((Number(linea.tasaImpuestoPct) || 0) / 100), 0,
  );
  const vencimiento = (() => {
    if (condicion === "CONTADO" || !fechaEmision) return null;
    const date = new Date(`${fechaEmision}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + (condicion === "CREDITO_15" ? 15 : 30));
    return date.toLocaleDateString("es-CO", { timeZone: "UTC" });
  })();

  async function fetchCatalogs() {
    const [insumosResponse, proveedoresResponse] = await Promise.all([
      fetch("/api/insumos/opciones"),
      fetch("/api/proveedores?activo=true"),
    ]);
    const [insumosData, proveedoresData] = await Promise.all([
      responseJson<InsumoDTO[]>(insumosResponse, "No se pudieron cargar los insumos"),
      responseJson<ProveedorDTO[]>(proveedoresResponse, "No se pudieron cargar los proveedores"),
    ]);
    return { insumosData, proveedoresData };
  }

  async function fetchPurchases() {
    const params = new URLSearchParams({ page: String(page), pageSize: "8", q });
    if (proveedorFiltro) params.set("proveedorId", proveedorFiltro);
    if (mes) {
      const [year, month] = mes.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
      params.set("desde", `${mes}-01`);
      params.set("hasta", `${mes}-${String(lastDay).padStart(2, "0")}`);
    }
    const [facturasResponse, resumenResponse, variacionesResponse] = await Promise.all([
      fetch(`/api/facturas-compra?${params}`),
      fetch(`/api/compras-insumos/resumen?mes=${mes}`),
      fetch("/api/insumos/variaciones-precio?horas=72"),
    ]);
    const [facturasData, resumenData, variacionesData] = await Promise.all([
      responseJson<PaginatedResponse<FacturaCompraDTO>>(facturasResponse, "No se pudo cargar el historial"),
      responseJson<ComprasResumenDTO>(resumenResponse, "No se pudo cargar el resumen"),
      responseJson<{ items: VariacionPrecioDTO[] }>(variacionesResponse, "No se pudo cargar el radar"),
    ]);
    const pendingIds = new Set(
      [...pendingDeletesRef.current].filter(([, viewKey]) => viewKey === purchasesViewKey).map(([id]) => id),
    );
    return {
      facturasData: omitPendingDeletes(facturasData, pendingIds),
      resumenData,
      variacionesData,
    };
  }

  async function fetchInvoicePage() {
    const params = new URLSearchParams({ page: String(page), pageSize: "8", q });
    if (proveedorFiltro) params.set("proveedorId", proveedorFiltro);
    if (mes) {
      const [year, month] = mes.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
      params.set("desde", `${mes}-01`);
      params.set("hasta", `${mes}-${String(lastDay).padStart(2, "0")}`);
    }
    const response = await fetch(`/api/facturas-compra?${params}`);
    return responseJson<PaginatedResponse<FacturaCompraDTO>>(response, "No se pudo cargar el historial");
  }

  async function loadAll() {
    setError("");
    try {
      const [catalogs, purchases] = await Promise.all([fetchCatalogs(), fetchPurchases()]);
      setInsumos(catalogs.insumosData);
      if (
        requestedInsumoId &&
        catalogs.insumosData.some((item) => item.id === requestedInsumoId) &&
        !form.getValues("lineas.0.insumoId")
      ) {
        form.setValue("lineas.0.insumoId", requestedInsumoId);
      }
      setProveedores(catalogs.proveedoresData);
      setFacturas(purchases.facturasData);
      setResumen(purchases.resumenData);
      setVariaciones(purchases.variacionesData.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las compras");
    } finally {
      setLoading(false);
    }
  }

  useLayoutEffect(() => {
    purchasesViewKeyRef.current = purchasesViewKey;
  }, [purchasesViewKey]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    if (loadInvoicePageOnlyRef.current) {
      loadInvoicePageOnlyRef.current = false;
      void fetchInvoicePage()
        .then((data) => { if (!cancelled) setFacturas(data); })
        .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el historial"); });
      return () => { cancelled = true; };
    }
    Promise.all([fetchCatalogs(), fetchPurchases()])
      .then(([catalogs, purchases]) => {
        if (cancelled) return;
        setInsumos(catalogs.insumosData);
        if (
          requestedInsumoId &&
          catalogs.insumosData.some((item) => item.id === requestedInsumoId) &&
          !form.getValues("lineas.0.insumoId")
        ) {
          form.setValue("lineas.0.insumoId", requestedInsumoId);
        }
        setProveedores(catalogs.proveedoresData);
        setFacturas(purchases.facturasData);
        setResumen(purchases.resumenData);
        setVariaciones(purchases.variacionesData.items);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las compras");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Los filtros forman la consulta paginada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, proveedorFiltro, mes]);

  async function guardar(values: FormValues, aplicar: boolean) {
    const response = await fetch("/api/facturas-compra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, aplicar }),
    });
    await responseJson(response, aplicar ? "No se pudo aplicar la factura" : "No se pudo guardar el borrador");
    form.reset(defaults());
    setPage(1);
    const purchases = await fetchPurchases();
    setFacturas(purchases.facturasData);
    setResumen(purchases.resumenData);
    setVariaciones(purchases.variacionesData.items);
    toast.success(aplicar ? "Factura registrada y aplicada" : "Borrador guardado");
  }

  async function crearProveedor() {
    const nombre = nuevoProveedor.trim();
    if (!nombre) return;
    const response = await fetch("/api/proveedores", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }),
    });
    await responseJson(response, "No se pudo crear el proveedor");
    setNuevoProveedor("");
    const catalogs = await fetchCatalogs();
    setInsumos(catalogs.insumosData);
    setProveedores(catalogs.proveedoresData);
    toast.success("Proveedor creado");
  }

  async function aplicarBorrador(id: string) {
    const response = await fetch(`/api/facturas-compra/${id}/aplicar`, { method: "POST" });
    await responseJson(response, "No se pudo aplicar el borrador");
    const purchases = await fetchPurchases();
    setFacturas(purchases.facturasData);
    setResumen(purchases.resumenData);
    setVariaciones(purchases.variacionesData.items);
    toast.success("Factura aplicada");
  }

  async function eliminarBorrador(id: string) {
    const deletion = removeOptimistically(facturas, id);
    const eraUnicaFilaVisible = facturas.items.length === 1;
    const paginaEliminada = page;
    const viewKeyAtDelete = purchasesViewKey;

    setFacturaAEliminar(null);
    if (!deletion.snapshot) return;

    pendingDeletesRef.current.set(id, viewKeyAtDelete);
    setFacturas((current) => removeOptimistically(current, id).next);

    try {
      const response = await fetch(`/api/facturas-compra/${id}`, { method: "DELETE" });
      if (!response.ok) await responseJson(response, "No se pudo eliminar el borrador");
      if (eraUnicaFilaVisible && paginaEliminada > 1 && purchasesViewKeyRef.current === viewKeyAtDelete) {
        loadInvoicePageOnlyRef.current = true;
        setPage((current) => current === paginaEliminada ? current - 1 : current);
      }
      toast.success("Borrador eliminado");
    } catch (actionError) {
      pendingDeletesRef.current.delete(id);
      if (purchasesViewKeyRef.current === viewKeyAtDelete) {
        setFacturas((current) => restoreOptimistically(current, deletion.snapshot!));
      }
      toast.error(actionError instanceof Error ? actionError.message : "No se pudo eliminar el borrador");
    }
  }

  const totalPages = Math.max(1, Math.ceil(facturas.total / facturas.pageSize));
  const visiblePages = Array.from(
    new Set([1, facturas.page - 1, facturas.page, facturas.page + 1, totalPages]),
  ).filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
  const firstVisibleInvoice = facturas.total === 0 ? 0 : (facturas.page - 1) * facturas.pageSize + 1;
  const lastVisibleInvoice = Math.min(facturas.page * facturas.pageSize, facturas.total);
  const monthLabel = mes
    ? new Date(`${mes}-01T00:00:00Z`).toLocaleDateString("es-CO", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Todos los períodos";

  if (loading) return <LoadingState message="Cargando compras y precios…" />;
  if (error) return <ErrorState message={error} onRetry={() => void loadAll()} />;

  return (
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-[80rem] -translate-x-1/2 bg-[#faf9f6] font-sans text-[#191c1e] sm:w-[calc(100vw-3rem)]">
      <div className="flex flex-col gap-6 py-2 sm:py-4">
        <section className="relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-xl bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] md:flex-row md:items-center">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-[#c25e19]" />
          <div className="flex flex-1 items-start gap-4 pl-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f0f9ff] text-[#0369a1]">
              <span className="material-symbols-outlined text-[22px]">auto_stories</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Cultura de Costeo: ¿Cómo impacta la inflación de compra en el Food Cost?</h2>
                <span className="rounded bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-semibold text-[#475569]">PEDAGOGÍA FINANCIERA</span>
              </div>
              <p className="mt-1 text-[13px] leading-5 text-[#475569]">
                Cada factura aplicada actualiza el costo del insumo y su historial. CalculaChef compara cada cambio para anticipar el impacto en las recetas y en el margen del restaurante.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#f1f5f9] p-2.5 font-mono text-xs text-[#0f172a]">
                <span className="font-semibold text-[#c25e19]">Fórmula activa:</span>
                <span>Costo base actualizado = precio de compra neto / cantidad neta recibida</span>
                <span className="text-[#94a3b8]">|</span>
                <span className="text-[#0369a1]">Último costo aplicado al escandallo</span>
              </div>
            </div>
          </div>
          <Tooltip content="Próximamente: importación automática de facturas">
            <button type="button" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-[#0f172a] shadow-sm opacity-60" disabled>
              <span className="material-symbols-outlined text-[20px] text-[#475569]">upload_file</span>
              Importar Factura (XML / PDF)
            </button>
          </Tooltip>
        </section>

        <section className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col justify-between gap-2 border-b border-[#e2e8f0] pb-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-[#c25e19]">post_add</span>
              <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Nueva Entrada de Factura</h2>
              <span className="ml-1 rounded-full bg-[#ffdbca] px-2 py-0.5 text-xs font-semibold text-[#773300]">Registro Rápido</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
              <span className="material-symbols-outlined text-[16px] text-[#0369a1]">info</span>
              Afecta inventario en tiempo real y actualiza escandallos
            </div>
          </div>

          <form className="mt-4 flex flex-col gap-4" onSubmit={form.handleSubmit((values) => guardar(values, true).catch((submitError) => toast.error(submitError.message)))}>
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
              <div className="relative flex flex-col gap-1 md:col-span-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="compra-proveedor" className="text-sm font-medium text-[#0f172a]">Proveedor</label>
                  <details className="group relative">
                    <summary className="cursor-pointer list-none text-[11px] font-semibold text-[#c25e19] hover:underline">+ Nuevo</summary>
                    <div className="absolute right-0 top-6 z-20 flex w-72 gap-2 rounded-lg border border-[#e2e8f0] bg-white p-3 shadow-lg">
                      <input aria-label="Nombre del nuevo proveedor" className="h-10 min-w-0 flex-1 rounded bg-[#f1f5f9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c25e19]/20" value={nuevoProveedor} onChange={(event) => setNuevoProveedor(event.target.value)} placeholder="Nombre del proveedor" />
                      <button type="button" className="rounded bg-[#0f172a] px-3 text-xs font-semibold text-white" onClick={() => void crearProveedor().catch((createError) => toast.error(createError.message))}>Crear</button>
                    </div>
                  </details>
                </div>
                <select id="compra-proveedor" className="h-11 w-full cursor-pointer appearance-none rounded-lg bg-[#f1f5f9] px-3 text-sm text-[#0f172a] outline-none focus:ring-2 focus:ring-[#c25e19]/20" {...form.register("proveedorId")}>
                  <option value="">Seleccionar proveedor</option>
                  {proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre} ({item.codigo})</option>)}
                </select>
                {form.formState.errors.proveedorId?.message ? <span className="text-xs font-medium text-[#b91c1c]">{form.formState.errors.proveedorId.message}</span> : null}
              </div>
              <div className="flex flex-col gap-1 md:col-span-3">
                <label htmlFor="compra-numero" className="text-xs font-medium text-[#0f172a]">N° Factura / Remisión</label>
                <div className="flex h-11 overflow-hidden rounded-lg bg-[#f1f5f9] focus-within:ring-2 focus-within:ring-[#c25e19]/20">
                  <select aria-label="Tipo de documento" className="w-[86px] bg-transparent pl-3 text-xs font-semibold text-[#475569] outline-none" {...form.register("tipo")}><option value="FAC">FAC</option><option value="REM">REM</option></select>
                  <input id="compra-numero" className="min-w-0 flex-1 bg-transparent px-2 font-mono text-[13px] text-[#0f172a] outline-none" {...form.register("numero")} placeholder="2025-0842" />
                </div>
                {form.formState.errors.numero?.message ? <span className="text-xs font-medium text-[#b91c1c]">{form.formState.errors.numero.message}</span> : null}
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label htmlFor="compra-fecha" className="text-xs font-medium text-[#0f172a]">Fecha Emisión</label>
                <input id="compra-fecha" className="h-11 w-full rounded-lg bg-[#f1f5f9] px-3 text-[13px] text-[#0f172a] outline-none focus:ring-2 focus:ring-[#c25e19]/20" type="date" {...form.register("fechaEmision")} />
                {form.formState.errors.fechaEmision?.message ? <span className="text-xs font-medium text-[#b91c1c]">{form.formState.errors.fechaEmision.message}</span> : null}
              </div>
              <div className="flex flex-col gap-1 md:col-span-3">
                <label htmlFor="compra-condicion" className="text-xs font-medium text-[#0f172a]">Condición y Método de Pago</label>
                <select id="compra-condicion" className="h-11 w-full cursor-pointer rounded-lg bg-[#f1f5f9] px-3 text-sm text-[#0f172a] outline-none focus:ring-2 focus:ring-[#c25e19]/20" {...form.register("condicionPago")}>
                  {Object.entries(condicionPagoLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {vencimiento ? <span className="text-[11px] text-[#64748b]">Vence: {vencimiento}</span> : null}
              </div>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => {
                const line = lineas[index];
                const lineTotal = (Number(line?.cantidad) || 0) * (Number(line?.precioUnitarioBruto) || 0) * (1 + (Number(line?.tasaImpuestoPct) || 0) / 100);
                const variation = variaciones.find((item) => item.insumoId === line?.insumoId);
                const selectedInsumo = insumos.find((item) => item.id === line?.insumoId);
                return (
                  <div key={field.id} className="rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase text-[#0f172a]">Línea de Insumo #{index + 1}</span>
                        {selectedInsumo?.recetasVinculadas ? <span className="rounded-full bg-[#f0f9ff] px-2 py-0.5 text-xs font-medium text-[#0369a1]">{selectedInsumo.recetasVinculadas} recetas vinculadas</span> : null}
                      </div>
                      {variation ? <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${variation.alerta ? "bg-[#fef2f2] text-[#b91c1c]" : variation.variacionPct <= 0 ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fffbeb] text-[#b45309]"}`}><span className="material-symbols-outlined text-[15px]">{variation.variacionPct <= 0 ? "trending_down" : "trending_up"}</span>{variation.variacionPct > 0 ? "+" : ""}{variation.variacionPct}% vs. compra anterior</span> : null}
                    </div>
                    <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-12">
                      <label className="flex flex-col gap-1 lg:col-span-4"><span className="text-xs text-[#475569]">Insumo del Catálogo</span><select className="h-10 w-full rounded bg-white px-3 text-[13px] text-[#0f172a] outline-none focus:ring-1 focus:ring-[#c25e19]" {...form.register(`lineas.${index}.insumoId`)}><option value="">Seleccionar insumo</option>{insumos.map((item) => <option key={item.id} value={item.id}>{item.nombre} ({item.codigo})</option>)}</select></label>
                      <label className="flex flex-col gap-1 lg:col-span-2"><span className="text-xs text-[#475569]">Cantidad Recibida</span><input className="h-10 w-full rounded bg-white px-3 text-[13px] tabular-nums text-[#0f172a] outline-none focus:ring-1 focus:ring-[#c25e19]" type="number" min="0.0001" step="0.0001" {...form.register(`lineas.${index}.cantidad`, { valueAsNumber: true })} /></label>
                      <label className="flex flex-col gap-1 lg:col-span-2"><span className="text-xs text-[#475569]">Unidad de Medida</span><select className="h-10 w-full rounded bg-white px-3 text-[13px] text-[#0f172a] outline-none focus:ring-1 focus:ring-[#c25e19]" {...form.register(`lineas.${index}.unidad`)}>{unidadBaseValues.map((value) => <option key={value} value={value}>{unidadBaseLabels[value]}</option>)}</select></label>
                      <label className="flex flex-col gap-1 lg:col-span-2"><span className="text-xs text-[#475569]">Precio Unitario Bruto</span><input className="h-10 w-full rounded bg-white px-3 text-[13px] font-semibold tabular-nums text-[#0f172a] outline-none focus:ring-1 focus:ring-[#c25e19]" type="number" min="0.0001" step="0.0001" {...form.register(`lineas.${index}.precioUnitarioBruto`, { valueAsNumber: true })} /></label>
                      <label className="flex flex-col gap-1 lg:col-span-2"><span className="text-xs text-[#475569]">IVA Aplicable</span><select className="h-10 w-full rounded bg-white px-3 text-[13px] text-[#0f172a] outline-none focus:ring-1 focus:ring-[#c25e19]" {...form.register(`lineas.${index}.tasaImpuestoPct`, { valueAsNumber: true })}><option value="0">Exento (0%)</option><option value="5">IVA 5%</option><option value="19">IVA 19%</option></select></label>
                    </div>
                    {form.formState.errors.lineas?.[index] ? <p className="mt-2 text-xs font-medium text-[#b91c1c]">Revisa los datos requeridos de esta línea.</p> : null}
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e2e8f0] pt-2">
                      <button type="button" className="inline-flex min-h-9 items-center gap-1 rounded bg-white px-3 text-xs font-semibold text-[#b91c1c] shadow-sm disabled:cursor-not-allowed disabled:opacity-40" disabled={fields.length === 1} onClick={() => remove(index)}><span className="material-symbols-outlined text-[16px]">delete</span>Quitar línea</button>
                      <div className="flex items-center gap-2"><span className="text-xs text-[#94a3b8]">Total línea:</span><strong className="text-lg tabular-nums text-[#0f172a]">{formatMoney(lineTotal)}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button" className="inline-flex min-h-9 self-start items-center gap-1 rounded bg-white px-3 text-xs font-semibold text-[#0f172a] shadow-sm ring-1 ring-[#e2e8f0]" onClick={() => append({ ...emptyLine })}><span className="material-symbols-outlined text-[16px] text-[#c25e19]">add_circle</span>Añadir Otro Insumo a la Factura</button>

            <div className="flex flex-col items-stretch justify-between gap-4 border-t border-[#e2e8f0] pt-4 lg:flex-row lg:items-center">
              <label className="flex flex-1 cursor-pointer items-start gap-2.5 rounded-lg bg-[#f1f5f9] p-2 text-xs text-[#475569]"><input type="checkbox" className="mt-0.5 size-4 accent-[#c25e19]" {...form.register("actualizaCostos")} /><span><strong className="block text-[#0f172a]">Actualizar costos base en recetas vinculadas automáticamente</strong>Usa el costo unitario de esta compra como nuevo costo del insumo.</span></label>
              <div className="flex flex-col items-end gap-4 sm:flex-row sm:items-center">
                <dl className="flex items-center gap-4 text-right">
                  <div><dt className="text-[11px] uppercase text-[#94a3b8]">Subtotal</dt><dd className="text-sm font-semibold tabular-nums text-[#0f172a]">{formatMoney(subtotal)}</dd></div>
                  <div><dt className="text-[11px] uppercase text-[#94a3b8]">IVA</dt><dd className="text-sm font-semibold tabular-nums text-[#0f172a]">{formatMoney(impuestos)}</dd></div>
                  <div className="h-8 w-px bg-[#e2e8f0]" />
                  <div><dt className="text-[11px] font-semibold uppercase text-[#c25e19]">Total Factura</dt><dd className="text-[22px] font-bold tabular-nums text-[#c25e19]">{formatMoney(subtotal + impuestos)}</dd></div>
                </dl>
                <div className="flex gap-2">
                  <button type="button" className="h-11 rounded-lg border border-[#e2e8f0] bg-white px-4 text-xs font-semibold text-[#475569] disabled:opacity-50" disabled={form.formState.isSubmitting} onClick={form.handleSubmit((values) => guardar(values, false).catch((submitError) => toast.error(submitError.message)))}>Guardar Borrador</button>
                  <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-6 text-sm font-semibold text-white shadow-md disabled:opacity-50" disabled={form.formState.isSubmitting}><span className="material-symbols-outlined text-[18px]">verified</span>Registrar y Aplicar a Costos</button>
                </div>
              </div>
            </div>
          </form>
        </section>

        {resumen ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Gasto del Mes en Materias Primas", value: formatMoney(resumen.gasto), icon: "payments", detail: resumen.variacionVsMesAnterior === null ? "Sin base anterior" : `${resumen.variacionVsMesAnterior > 0 ? "+" : ""}${resumen.variacionVsMesAnterior}% vs. mes anterior`, tone: resumen.variacionVsMesAnterior !== null && resumen.variacionVsMesAnterior > 0 ? "danger" : "neutral" },
              { title: "Facturas Registradas", value: `${resumen.facturas} facturas`, icon: "receipt", detail: `${resumen.proveedores} proveedores locales`, tone: "neutral" },
              { title: "Alertas de Variación de Precio", value: `${resumen.alertasVariacion} insumos`, icon: "warning", detail: "Requieren revisión", tone: resumen.alertasVariacion ? "warning" : "success" },
              { title: "Proveedores del Mes", value: String(resumen.proveedores), icon: "storefront", detail: `${proveedores.length} proveedores activos`, tone: "success" },
            ].map((item) => (
              <article key={item.title} className="flex min-h-36 flex-col justify-between rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <div className="flex items-start justify-between gap-3 text-[#94a3b8]"><h3 className="text-xs font-semibold uppercase leading-4 tracking-wider">{item.title}</h3><span className="material-symbols-outlined text-[20px]">{item.icon}</span></div>
                <div><div className={`text-[30px] font-bold leading-9 tracking-[-0.03em] tabular-nums ${item.tone === "danger" ? "text-[#b91c1c]" : item.tone === "success" ? "text-[#15803d]" : "text-[#0f172a]"}`}>{item.value}</div><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.tone === "danger" ? "bg-[#fef2f2] text-[#b91c1c]" : item.tone === "warning" ? "bg-[#fffbeb] text-[#b45309]" : item.tone === "success" ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#f1f5f9] text-[#475569]"}`}>{item.detail}</span></div>
              </article>
            ))}
          </section>
        ) : null}

        <section className="rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col justify-between gap-2 border-b border-[#e2e8f0] pb-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2"><span className="size-2.5 animate-pulse rounded-full bg-[#b91c1c]" /><h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Radar de Variación de Precios (Últimas 72h)</h2></div>
            <span className="self-start rounded-full bg-[#fffbeb] px-2.5 py-1 text-xs font-medium text-[#b45309] sm:self-auto">{variaciones.length} insumos con variación detectada</span>
          </div>
          {variaciones.length ? <div className="mt-4 flex flex-col gap-2">{variaciones.slice(0, 3).map((item) => {
            const favorable = item.variacionPct <= 0;
            const critical = item.alerta;
            return <article key={item.insumoId} className={`flex flex-col justify-between gap-4 rounded-xl p-4 md:flex-row md:items-center ${critical ? "border-l-4 border-[#b91c1c] bg-[#fef2f2]/50" : favorable ? "bg-[#f0fdf4]/50" : "bg-[#faf9f6]"}`}>
              <div className="flex items-start gap-4"><div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${critical ? "bg-[#fef2f2] text-[#b91c1c]" : favorable ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fffbeb] text-[#b45309]"}`}><span className="material-symbols-outlined text-[22px]">{critical ? "warning" : favorable ? "trending_down" : "monitoring"}</span></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-[#0f172a]">{item.nombre}</h3><span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${critical ? "bg-[#b91c1c] text-white" : favorable ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fffbeb] text-[#b45309]"}`}>{item.variacionPct > 0 ? "▲ +" : "▼ "}{item.variacionPct}%{critical ? " CRÍTICO" : favorable ? " FAVORABLE" : ""}</span></div><p className="mt-0.5 text-xs text-[#94a3b8]">{item.codigo} <span className="mx-1">•</span> <span className="font-mono">Anterior: {formatMoney(item.precioAnterior)} → Hoy: {formatMoney(item.precioActual)}</span></p><p className={`mt-2 flex items-center gap-1.5 text-xs ${critical ? "font-medium text-[#b91c1c]" : favorable ? "font-medium text-[#15803d]" : "text-[#475569]"}`}><span className="material-symbols-outlined text-[15px]">restaurant_menu</span>Impacta {item.recetasAfectadas} recetas. Cambio acumulado: {formatMoney(item.costoRecetasDespues - item.costoRecetasAntes)}.</p></div></div>
              <span className={`self-end rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow-sm md:self-center ${critical ? "text-[#b91c1c]" : favorable ? "text-[#15803d]" : "text-[#0f172a]"}`}>{favorable ? "Costo Actualizado" : "Analizar Recetas"}</span>
            </article>;
          })}</div> : <EmptyState title="Sin variaciones recientes" description="Aparecerán al comparar dos compras del mismo insumo." />}
        </section>

        <section className="rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col justify-between gap-2 border-b border-[#e2e8f0] pb-2 sm:flex-row sm:items-center">
            <div><h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Historial de Facturas y Compras Recientes</h2><p className="text-[13px] text-[#94a3b8]">Trazabilidad de entradas físicas e impacto contable en inventarios</p></div>
            <div className="flex gap-2"><button type="button" aria-label="Exportar historial" className="flex size-10 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#475569]" onClick={() => window.print()}><span className="material-symbols-outlined text-[20px]">download</span></button><button type="button" aria-label="Imprimir historial" className="flex size-10 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#475569]" onClick={() => window.print()}><span className="material-symbols-outlined text-[20px]">print</span></button></div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg bg-[#faf9f6] p-2 md:grid-cols-12">
            <label className="relative md:col-span-5"><span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#94a3b8]">search</span><input aria-label="Buscar factura o proveedor" className="h-10 w-full rounded bg-white pl-9 pr-3 text-[13px] text-[#0f172a] outline-none focus:ring-1 focus:ring-[#c25e19]" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Buscar por N° factura o proveedor..." /></label>
            <label className="relative md:col-span-3"><span className="sr-only">Mes</span><input className="h-10 w-full rounded bg-white px-3 text-[13px] text-[#0f172a] outline-none focus:ring-1 focus:ring-[#c25e19]" type="month" value={mes} onChange={(event) => { setMes(event.target.value); setPage(1); }} /></label>
            <label className="relative md:col-span-4"><span className="sr-only">Proveedor</span><select className="h-10 w-full rounded bg-white px-3 text-[13px] text-[#0f172a] outline-none focus:ring-1 focus:ring-[#c25e19]" value={proveedorFiltro} onChange={(event) => { setProveedorFiltro(event.target.value); setPage(1); }}><option value="">Todos los proveedores ({proveedores.length})</option>{proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          </div>
          {facturas.items.length ? <div className="mt-1 divide-y divide-[#e2e8f0]">{facturas.items.map((factura) => <article key={factura.id} className="flex flex-col justify-between gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-[#faf9f6]/60 md:flex-row md:items-center">
            <div className="flex items-start gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f9] font-mono text-[11px] font-bold text-[#0f172a]">{factura.tipo}</div><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#0f172a]">#{factura.tipo}-{factura.numero}</strong><span className="text-sm font-medium text-[#0f172a]">{factura.proveedor.nombre}</span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${factura.estado === "APLICADA" ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fffbeb] text-[#b45309]"}`}><span className="size-1.5 rounded-full bg-current" />{factura.estado === "APLICADA" ? "Aplicada a inventario" : "Borrador"}</span></div><div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#94a3b8]"><span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">event</span>{new Date(factura.fechaEmision).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</span><span>•</span><span>{factura.lineas.length} insumos recibidos</span><span>•</span><span>{condicionPagoLabels[factura.condicionPago]}</span></div></div></div>
            <div className="flex shrink-0 items-center gap-4 self-end md:self-center"><div className="text-right"><strong className="block text-lg tabular-nums text-[#0f172a]">{formatMoney(factura.total)}</strong><span className="text-[11px] text-[#94a3b8]">{factura.estado === "APLICADA" ? "Costo base actualizado" : "Pendiente de aplicar"}</span></div>{factura.estado === "BORRADOR" ? <div className="flex gap-1"><button type="button" className="h-9 rounded-lg bg-[#0f172a] px-3 text-xs font-semibold text-white" onClick={() => void aplicarBorrador(factura.id).catch((actionError) => toast.error(actionError.message))}>Aplicar</button><button type="button" aria-label={`Eliminar ${factura.tipo}-${factura.numero}`} className="flex size-9 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b91c1c]" onClick={() => setFacturaAEliminar(factura)}><span className="material-symbols-outlined text-[18px]">delete</span></button></div> : <span className="flex size-9 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#475569]"><span className="material-symbols-outlined text-[20px]">chevron_right</span></span>}</div>
          </article>)}</div> : <EmptyState className="mt-4" title="No hay facturas para estos filtros" />}
          <nav className="mt-2 flex flex-col items-center justify-between gap-3 border-t border-[#e2e8f0] pt-4 sm:flex-row" aria-label="Paginación del historial">
            <p className="text-[13px] text-[#94a3b8]">Mostrando <strong className="font-medium text-[#0f172a]">{firstVisibleInvoice}{firstVisibleInvoice !== lastVisibleInvoice ? `–${lastVisibleInvoice}` : ""}</strong> de <strong className="font-medium text-[#0f172a]">{facturas.total}</strong> facturas en {monthLabel}</p>
            <div className="flex items-center gap-1"><button type="button" className="h-9 rounded-lg bg-[#f1f5f9] px-3 text-xs font-semibold text-[#475569] disabled:cursor-not-allowed disabled:text-[#94a3b8]" disabled={facturas.page <= 1} onClick={() => setPage(facturas.page - 1)}>Anterior</button>{visiblePages.map((pageNumber, index) => <span key={pageNumber} className="contents">{index > 0 && pageNumber - visiblePages[index - 1]! > 1 ? <span className="px-1 text-[#94a3b8]">…</span> : null}<button type="button" aria-current={pageNumber === facturas.page ? "page" : undefined} className={`size-9 rounded-lg text-xs font-semibold ${pageNumber === facturas.page ? "bg-[#c25e19] text-white" : "text-[#0f172a] hover:bg-[#f1f5f9]"}`} onClick={() => setPage(pageNumber)}>{pageNumber}</button></span>)}<button type="button" className="h-9 rounded-lg bg-white px-3 text-xs font-semibold text-[#0f172a] shadow-sm disabled:cursor-not-allowed disabled:text-[#94a3b8]" disabled={facturas.page >= totalPages} onClick={() => setPage(facturas.page + 1)}>Siguiente</button></div>
          </nav>
        </section>
      </div>
      <ConfirmModal
        open={facturaAEliminar !== null}
        title="Eliminar borrador"
        description={facturaAEliminar ? `Se eliminará ${facturaAEliminar.tipo}-${facturaAEliminar.numero}. Esta acción no se puede deshacer.` : undefined}
        confirmLabel="Eliminar borrador"
        variant="danger"
        onCancel={() => setFacturaAEliminar(null)}
        onConfirm={() => {
          if (!facturaAEliminar) return;
          void eliminarBorrador(facturaAEliminar.id)
            .catch((actionError) => toast.error(actionError.message))
            .finally(() => setFacturaAEliminar(null));
        }}
      />
    </div>
  );
}
