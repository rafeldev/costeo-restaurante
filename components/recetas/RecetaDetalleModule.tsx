"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { CosteoDTO, InsumoDTO, ProduccionDTO, RecetaDTO, StockShortageDTO } from "@/lib/api-types";
import { categoriaRecetaLabels, categoriaRecetaValues, unidadBaseShort } from "@/lib/domain";
import { formatMoney, formatPercent } from "@/lib/format";
import { calculateFoodCostPct } from "@/lib/pricing/getRecipeProfitabilityGuidance";
import { recetaSchema } from "@/lib/validation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { toast } from "sonner";

type Props = { recetaId: string };
type RecipeFormValues = z.input<typeof recetaSchema>;

const card = "rounded-xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]";
const field = "h-11 w-full rounded-lg border-0 bg-white px-3 text-sm text-[#0f172a] shadow-[0_1px_3px_rgba(15,23,42,0.12)] outline-none transition focus:ring-2 focus:ring-[#c25e19]";

function Icon({ children, className = "" }: { children: string; className?: string }) {
  return <span aria-hidden="true" className={`material-symbols-outlined leading-none ${className}`}>{children}</span>;
}

export function RecetaDetalleModule({ recetaId }: Props) {
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [receta, setReceta] = useState<RecetaDTO | null>(null);
  const [costeo, setCosteo] = useState<CosteoDTO | null>(null);
  const [producciones, setProducciones] = useState<ProduccionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [unidadesProduccion, setUnidadesProduccion] = useState(1);
  const [isProducing, setIsProducing] = useState(false);
  const [showProducirConfirm, setShowProducirConfirm] = useState(false);

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recetaSchema),
    defaultValues: {
      nombre: "",
      categoria: "PLATOS_FUERTES",
      rendimientoPorciones: 1,
      tiempoPreparacionMin: undefined,
      precioVentaActual: undefined,
      borrador: false,
      activa: true,
      ingredientes: [{ insumoId: "", cantidad: 1 }],
    },
  });
  const { reset } = form;
  const ingredients = useWatch({ control: form.control, name: "ingredientes" });
  const ingredientsFieldArray = useFieldArray({ control: form.control, name: "ingredientes" });

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [insumosResponse, recetaResponse, costeoResponse, produccionesResponse] = await Promise.all([
        fetch("/api/insumos/opciones"),
        fetch(`/api/recetas/${recetaId}`),
        fetch(`/api/recetas/${recetaId}/costeo`),
        fetch(`/api/producciones?recetaId=${recetaId}`),
      ]);
      if (!insumosResponse.ok || !recetaResponse.ok || !costeoResponse.ok) throw new Error("No se pudieron cargar los datos de la receta");
      const [insumosData, recetaData, costeoData]: [InsumoDTO[], RecetaDTO, CosteoDTO] = await Promise.all([insumosResponse.json(), recetaResponse.json(), costeoResponse.json()]);
      const produccionesData: ProduccionDTO[] = produccionesResponse.ok ? await produccionesResponse.json() : [];
      setInsumos(insumosData);
      setReceta(recetaData);
      setCosteo(costeoData);
      setProducciones(produccionesData);
      reset({
        nombre: recetaData.nombre,
        categoria: recetaData.categoria,
        rendimientoPorciones: recetaData.rendimientoPorciones,
        tiempoPreparacionMin: recetaData.tiempoPreparacionMin ?? undefined,
        precioVentaActual: recetaData.precioVentaActual ?? undefined,
        borrador: recetaData.borrador,
        activa: recetaData.activa,
        ingredientes: recetaData.ingredientes?.map((item) => ({ insumoId: item.insumoId, cantidad: item.cantidad })) ?? [{ insumoId: "", cantidad: 1 }],
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [recetaId, reset]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function onSubmit(values: RecipeFormValues) {
    const response = await fetch(`/api/recetas/${recetaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo actualizar la receta");
    }
    await loadData();
    toast.success("Receta actualizada");
  }

  async function registrarProduccion() {
    if (!Number.isInteger(unidadesProduccion) || unidadesProduccion <= 0) {
      toast.error("Las unidades producidas deben ser un número entero mayor a cero");
      return;
    }
    setIsProducing(true);
    try {
      const response = await fetch(`/api/recetas/${recetaId}/producir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unidades: unidadesProduccion }) });
      if (!response.ok) {
        const body: { message?: string; faltantes?: StockShortageDTO[] } = await response.json().catch(() => ({}));
        if (body.faltantes?.length) {
          toast.error(body.message ?? "Stock insuficiente", { description: body.faltantes.map((item) => `${item.nombre}: requiere ${item.requerido}, disponible ${item.disponible}`).join(" · ") });
          return;
        }
        throw new Error(body.message ?? "No se pudo registrar la producción");
      }
      toast.success("Producción registrada y stock actualizado");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsProducing(false);
    }
  }

  if (loading) return <LoadingState message="Cargando detalle de receta…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => void loadData()} />;

  const recetaNombre = form.watch("nombre");
  const foodCost = costeo
    ? calculateFoodCostPct(costeo.costoPorPorcion, receta?.precioVentaActual ?? null, costeo.impuestoPct)
    : null;
  const margin = costeo?.margenRealPct ?? null;
  const status = costeo?.semaforoRentabilidad;
  const statusStyles = status === "verde" ? "bg-[#f0fdf4] text-[#15803d]" : status === "amarillo" ? "bg-[#fffbeb] text-[#b45309]" : status === "rojo" ? "bg-[#fef2f2] text-[#b91c1c]" : "bg-[#f1f5f9] text-[#64748b]";
  const statusLabel = status === "verde" ? "Rentable" : status === "amarillo" ? "Ajustar PVP" : status === "rojo" ? "Margen crítico" : "Sin precio";

  return (
    <div className="recipe-detail-stitch relative left-1/2 w-[calc(100vw-2rem)] max-w-[1232px] -translate-x-1/2 space-y-6 text-[#191c1e] sm:w-[calc(100vw-3rem)]">
      <style>{`main > header:has(+ .recipe-detail-stitch) { display: none; }`}</style>
      <ConfirmModal open={showProducirConfirm} title="Registrar producción" description="Se descontarán los insumos del inventario según esta receta." confirmLabel="Registrar producción" onConfirm={() => { setShowProducirConfirm(false); void registrarProduccion(); }} onCancel={() => setShowProducirConfirm(false)}>
        <p>Unidades a producir: <strong>{unidadesProduccion}</strong>. La operación se cancelará si algún insumo no tiene stock suficiente.</p>
      </ConfirmModal>

      <header className={`${card} flex flex-col justify-between gap-4 p-6 md:flex-row md:items-end`}>
        <div className="max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#64748b]"><Link href="/recetas" className="transition hover:text-[#c25e19]">Recetas y Escandallos</Link><Icon className="text-[16px]">chevron_right</Icon><span className="text-[#0f172a]">{receta?.codigo ?? "Ficha técnica"}</span></nav>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em] text-[#0f172a]">{recetaNombre || "Ficha técnica"}</h1><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel}</span></div>
          <p className="mt-1 text-sm leading-6 text-[#475569]">Ficha técnica maestra, escandallo por ingrediente y control de producción en una sola vista.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/recetas" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#f1f5f9] px-4 text-sm font-medium text-[#0f172a] shadow-sm transition hover:bg-[#e2e8f0]"><Icon className="text-[20px]">arrow_back</Icon> Volver al catálogo</Link>
          <button type="button" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#c25e19] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#9a3412] disabled:opacity-50" disabled={isProducing} onClick={() => {
            if (!Number.isInteger(unidadesProduccion) || unidadesProduccion <= 0) return toast.error("Las unidades producidas deben ser un número entero mayor a cero");
            setShowProducirConfirm(true);
          }}><Icon className="text-[20px]">skillet</Icon>{isProducing ? "Registrando…" : "Lanzar producción"}</button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Costo por Porción" icon="receipt_long" value={formatMoney(costeo?.costoPorPorcion ?? 0)} detail="Costo total con merma" />
        <Kpi title="Food Cost Actual" icon="pie_chart" value={foodCost === null ? "—" : formatPercent(foodCost)} detail={foodCost !== null && foodCost <= 35 ? "Dentro del objetivo" : "Revisar contra objetivo"} tone={foodCost !== null && foodCost > 50 ? "danger" : "success"} />
        <Kpi title="Margen Real" icon="trending_up" value={margin === null ? "—" : formatPercent(margin)} detail="Sobre PVP actual" />
        <Kpi title="PVP Sugerido" icon="sell" value={formatMoney(costeo?.precioSugeridoFinal ?? 0)} detail="Impuesto y redondeo incluidos" accent />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <section className={`${card} space-y-4 p-6 lg:col-span-5`}>
          <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2"><div><h2 className="text-lg font-semibold text-[#0f172a]">Editar Ficha Técnica</h2><p className="text-[13px] text-[#475569]">Actualiza gramajes y rendimiento.</p></div><span className="inline-flex items-center gap-1 rounded bg-[#f1f5f9] px-2 py-1 text-xs font-semibold text-[#475569]"><Icon className="text-[16px] text-[#c25e19]">edit_note</Icon>{receta?.codigo}</span></div>
          <form className="space-y-4" onSubmit={form.handleSubmit(async (values) => { try { await onSubmit(values); } catch (error) { toast.error(error instanceof Error ? error.message : "Error inesperado"); } })}>
            <FormLabel label="Nombre de la Receta" error={form.formState.errors.nombre?.message}><input className={field} {...form.register("nombre")} /></FormLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FormLabel label="Tipo / Categoría" error={form.formState.errors.categoria?.message}><select className={field} {...form.register("categoria")}>{categoriaRecetaValues.map((value) => <option key={value} value={value}>{categoriaRecetaLabels[value]}</option>)}</select></FormLabel>
              <FormLabel label="Rendimiento (porciones)" error={form.formState.errors.rendimientoPorciones?.message}><input className={field} type="number" min="1" {...form.register("rendimientoPorciones", { valueAsNumber: true })} /></FormLabel>
              <FormLabel label="Tiempo en Cocina" error={form.formState.errors.tiempoPreparacionMin?.message}><input className={field} type="number" min="1" placeholder="Minutos" {...form.register("tiempoPreparacionMin", { setValueAs: (value) => value === "" ? undefined : Number(value) })} /></FormLabel>
              <FormLabel label="PVP Actual Carta" hint="Opcional" error={form.formState.errors.precioVentaActual?.message}><input className={field} type="number" min="0" step="0.01" {...form.register("precioVentaActual", { setValueAs: (value) => value === "" ? undefined : Number(value) })} /></FormLabel>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><h3 className="text-lg font-semibold text-[#0f172a]">Ingredientes</h3><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-semibold text-[#475569]">{ingredientsFieldArray.fields.length} añadidos</span></div><button type="button" className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-[#c25e19] hover:text-[#9a3412]" onClick={() => ingredientsFieldArray.append({ insumoId: "", cantidad: 1 })}><Icon className="text-[16px]">add_circle</Icon>Añadir línea</button></div>
              <div className="space-y-2">{ingredientsFieldArray.fields.map((ingredientField, index) => {
                const selected = insumos.find((item) => item.id === ingredients?.[index]?.insumoId);
                const breakdown = costeo?.desgloseIngredientes.find((item) => item.insumoId === selected?.id);
                return <div key={ingredientField.id} className="rounded-lg bg-[#f1f5f9] p-2.5 shadow-sm"><div className="grid grid-cols-[minmax(0,1fr)_92px_34px] items-center gap-2"><select aria-label={`Insumo ${index + 1}`} className="h-9 min-w-0 rounded-md border-0 bg-white px-2 text-[13px] outline-none focus:ring-2 focus:ring-[#c25e19]" {...form.register(`ingredientes.${index}.insumoId` as const)}><option value="">Selecciona insumo...</option>{insumos.map((insumo) => <option key={insumo.id} value={insumo.id}>{insumo.codigo} · {insumo.nombre}</option>)}</select><input aria-label={`Cantidad ${index + 1}`} className="h-9 min-w-0 rounded-md border-0 bg-white px-2 text-[13px] outline-none focus:ring-2 focus:ring-[#c25e19]" type="number" min="0" step="0.0001" placeholder={selected ? unidadBaseShort[selected.unidadBase] : "Cant."} {...form.register(`ingredientes.${index}.cantidad` as const, { valueAsNumber: true })} /><button aria-label="Quitar ingrediente" type="button" className="flex h-9 w-9 items-center justify-center rounded-md text-[#94a3b8] hover:bg-[#fef2f2] hover:text-[#b91c1c] disabled:opacity-30" onClick={() => ingredientsFieldArray.remove(index)} disabled={ingredientsFieldArray.fields.length === 1}><Icon className="text-[18px]">close</Icon></button></div>{selected ? <div className="mt-1.5 flex justify-between text-xs text-[#475569]"><span>{selected.mermaPct > 0 ? `Merma ${formatPercent(selected.mermaPct)}` : unidadBaseShort[selected.unidadBase]} · Neto {formatMoney(selected.costoNetoReal)}/{unidadBaseShort[selected.unidadBase]}</span>{breakdown ? <strong className="font-mono text-[#0f172a]">{formatMoney(breakdown.costoAplicado)}</strong> : null}</div> : null}</div>;
              })}</div>
              <p className="text-[11px] text-[#94a3b8]">La cantidad se registra en la unidad base y deduce la merma configurada.</p>
            </div>

            <div className="flex flex-wrap gap-4"><label className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-[#475569]"><input type="checkbox" className="accent-[#c25e19]" {...form.register("borrador")} /> Guardar como borrador</label><label className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-[#475569]"><input type="checkbox" className="accent-[#c25e19]" {...form.register("activa")} /> Receta activa</label></div>
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] text-sm font-medium text-white shadow-sm hover:bg-[#475569] disabled:opacity-50" type="submit" disabled={form.formState.isSubmitting}><Icon className="text-[18px]">check_circle</Icon>{form.formState.isSubmitting ? "Guardando…" : "Guardar Cambios de Ficha"}</button>
          </form>
        </section>

        <div className="space-y-4 lg:col-span-7">
          <section className={`${card} p-6`}>
            <div className="flex items-start justify-between border-b border-[#e2e8f0] pb-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#475569]">Resultado del Escandallo</p><h2 className="mt-1 text-lg font-semibold text-[#0f172a]">Resumen financiero de la receta</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles}`}>{statusLabel}</span></div>
            {costeo ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><CostMetric label="Materia prima" value={formatMoney(costeo.costoMateriaPrima)} icon="inventory_2" /><CostMetric label="Costo total" value={formatMoney(costeo.costoTotal)} icon="calculate" /><CostMetric label="Costo / porción" value={formatMoney(costeo.costoPorPorcion)} icon="restaurant" /><CostMetric label="PVP sin impuesto" value={formatMoney(costeo.precioSugeridoSinImpuesto)} icon="request_quote" /><CostMetric label="PVP sugerido final" value={formatMoney(costeo.precioSugeridoFinal)} icon="sell" accent /><CostMetric label="Margen real" value={costeo.margenRealPct === null ? "Sin PVP" : formatPercent(costeo.margenRealPct)} icon="trending_up" /></div> : <p className="mt-3 text-sm text-[#475569]">No hay datos de costeo.</p>}
          </section>

          <section className={`${card} p-6`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f0f9ff] text-[#0369a1]"><Icon className="text-[22px]">skillet</Icon></div><div><h2 className="text-base font-semibold text-[#0f172a]">Registrar Producción</h2><p className="text-[13px] text-[#475569]">Descuenta inventario según gramajes y merma.</p></div></div></div><div className="flex items-end gap-2"><label className="block"><span className="mb-1 block text-xs font-medium text-[#0f172a]">Unidades</span><input className="h-10 w-24 rounded-lg border-0 bg-[#f1f5f9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c25e19]" type="number" min="1" step="1" value={unidadesProduccion} onChange={(event) => setUnidadesProduccion(Number(event.target.value))} /></label><button type="button" className="h-10 rounded-lg bg-[#c25e19] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#9a3412] disabled:opacity-50" disabled={isProducing} onClick={() => {
              if (!Number.isInteger(unidadesProduccion) || unidadesProduccion <= 0) return toast.error("Las unidades producidas deben ser un número entero mayor a cero");
              setShowProducirConfirm(true);
            }}>Registrar</button></div></div>
          </section>

          <section className={`${card} p-6`}>
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3"><div><h2 className="text-lg font-semibold text-[#0f172a]">Líneas del Escandallo</h2><p className="text-[13px] text-[#475569]">Costo neto aplicado por ingrediente.</p></div><span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-semibold text-[#475569]">{costeo?.desgloseIngredientes.length ?? 0} líneas</span></div>
            {!costeo?.desgloseIngredientes.length ? <p className="mt-3 text-sm text-[#475569]">Sin ingredientes para mostrar.</p> : <div className="mt-3 space-y-2">{costeo.desgloseIngredientes.map((item) => <article key={item.insumoId} className="grid grid-cols-2 items-center gap-2 rounded-lg bg-[#faf9f6] p-3 sm:grid-cols-[minmax(0,1.5fr)_0.7fr_0.8fr_0.8fr]"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#0f172a]">{item.nombre}</p><p className="text-xs text-[#64748b]">Merma {formatPercent(item.mermaPct)}</p></div><LineValue label="Cantidad" value={String(item.cantidad)} /><LineValue label="Costo neto" value={formatMoney(item.costoNetoUnitario)} /><LineValue label="Costo aplicado" value={formatMoney(item.costoAplicado)} strong /></article>)}</div>}
          </section>

          <section className={`${card} p-6`}>
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-[#0f172a]">Historial de Producción</h2><p className="text-[13px] text-[#475569]">Últimos movimientos registrados.</p></div>{producciones.length > 10 ? <Link href={`/producciones?recetaId=${recetaId}`} className="text-xs font-semibold text-[#c25e19] hover:underline">Ver todas ({producciones.length})</Link> : null}</div>
            {!producciones.length ? <div className="mt-4 rounded-lg bg-[#f1f5f9] p-4 text-center text-sm text-[#475569]">Aún no se ha registrado producción para esta receta.</div> : <div className="mt-3 space-y-2">{producciones.slice(0, 10).map((production) => {
              const anulada = production.estado === "ANULADA";
              return <div key={production.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm ${anulada ? "bg-[#fef2f2] opacity-75" : "bg-[#f1f5f9]"}`}><div className="flex flex-wrap items-center gap-3"><span className="text-[#475569]">{new Date(production.fechaProduccion).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span><strong className="text-[#0f172a]">{production.unidades} ud.</strong><span className="font-mono text-[#475569]">{formatMoney(production.costoTotalProduccion)}</span></div><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${anulada ? "bg-[#fef2f2] text-[#b91c1c]" : "bg-[#f0fdf4] text-[#15803d]"}`}>{production.estado}</span></div>;
            })}</div>}
          </section>

          <aside className={`${card} flex items-start gap-2 border-l-4 border-l-[#c25e19] p-4`}><Icon className="mt-0.5 text-[22px] text-[#c25e19]">insights</Icon><div><h3 className="text-sm font-bold text-[#0f172a]">Lectura de rentabilidad</h3><p className="mt-0.5 text-[13px] leading-5 text-[#475569]">{foodCost === null ? "Añade un PVP actual para comparar la receta con el objetivo de Food Cost." : foodCost > 50 ? `El Food Cost de ${formatPercent(foodCost)} exige revisar gramajes o ajustar el precio hacia ${formatMoney(costeo?.precioSugeridoFinal ?? 0)}.` : `La receta mantiene un Food Cost de ${formatPercent(foodCost)}. Conserva el estándar de porcionado para proteger este margen.`}</p></div></aside>
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, icon, value, detail, accent = false, tone }: { title: string; icon: string; value: string; detail: string; accent?: boolean; tone?: "success" | "danger" }) {
  const detailClass = tone === "danger" ? "bg-[#fef2f2] text-[#b91c1c]" : tone === "success" ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#f1f5f9] text-[#475569]";
  return <article className={`${card} flex min-h-[132px] flex-col justify-between p-4`}><div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#94a3b8]"><span>{title}</span><Icon className={`text-[20px] ${accent ? "text-[#c25e19]" : "text-[#475569]"}`}>{icon}</Icon></div><p className={`mt-2 text-[30px] font-bold leading-9 tracking-[-0.03em] ${accent ? "text-[#c25e19]" : "text-[#0f172a]"}`}>{value}</p><span className={`mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${detailClass}`}>{detail}</span></article>;
}

function FormLabel({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="flex items-center justify-between text-sm font-medium text-[#0f172a]">{label}{hint ? <small className="text-xs font-normal text-[#94a3b8]">{hint}</small> : null}</span>{children}{error ? <span className="block text-xs text-[#b91c1c]">{error}</span> : null}</label>;
}

function CostMetric({ label, value, icon, accent = false }: { label: string; value: string; icon: string; accent?: boolean }) {
  return <div className="rounded-lg bg-[#faf9f6] p-3"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">{label}</p><Icon className={`text-[17px] ${accent ? "text-[#c25e19]" : "text-[#64748b]"}`}>{icon}</Icon></div><p className={`mt-1 font-mono text-base font-bold ${accent ? "text-[#c25e19]" : "text-[#0f172a]"}`}>{value}</p></div>;
}

function LineValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div><p className="text-[10px] font-semibold uppercase text-[#94a3b8]">{label}</p><p className={`font-mono text-xs ${strong ? "font-bold text-[#0f172a]" : "text-[#475569]"}`}>{value}</p></div>;
}
