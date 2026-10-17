"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardDTO } from "@/lib/dashboard";
import { AlertasInventarioCard } from "@/components/inventario/AlertasInventarioCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatusBadge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";

const formatPct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

const moduleCards = [
  { icon: "kitchen", title: "Insumos y Mermas", description: "Registra materias primas, gramajes brutos vs. netos, factor de merma y costos por unidad de compra.", href: "/insumos", action: "Gestionar insumos" },
  { icon: "menu_book", title: "Fichas Técnicas", description: "Estandariza recetas maestras, rendimientos por porción y precio de venta sugerido.", href: "/recetas", action: "Escandallo de recetas" },
  { icon: "tune", title: "Estructura Financiera", description: "Configura overhead, impuestos al consumo, margen objetivo y política de redondeo.", href: "/configuracion", action: "Parámetros de costo" },
];

export function DashboardModule() {
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el centro de control.");
        return response.json() as Promise<DashboardDTO>;
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState message="Calculando indicadores financieros…" />;

  const kpis = [
    { label: "Food Cost Promedio", icon: "pie_chart", iconColor: "text-[#15803d]", value: formatPct(data.foodCost.valor), valueColor: "text-[#0f172a]", note: data.foodCost.deltaMensual === null ? "Sin histórico mensual" : `${data.foodCost.deltaMensual >= 0 ? "+" : ""}${formatPct(data.foodCost.deltaMensual)} m/m`, tone: "success", footer: `En rango óptimo (${data.foodCost.rango})` },
    { label: "Margen Contribución", icon: "trending_up", iconColor: "text-[#0369a1]", value: formatPct(data.margen.valor), valueColor: "text-[#0f172a]", note: data.margen.deltaVsObjetivo === null ? "Sin PVP configurado" : `${data.margen.deltaVsObjetivo >= 0 ? "+" : ""}${formatPct(data.margen.deltaVsObjetivo)} vs obj`, tone: "info", footer: "Superávit operativo saludable" },
    { label: "Recetas en Riesgo", icon: "warning_amber", iconColor: "text-[#b45309]", value: String(data.recetas.enRiesgo), valueColor: "text-[#b45309]", note: `de ${data.recetas.activas} platos`, tone: "warning", footer: `${data.recetas.aRevisar} requieren revisión` },
    { label: "Stock Crítico", icon: "inventory_2", iconColor: "text-[#b91c1c]", value: String(data.insumos.criticos), valueColor: "text-[#b91c1c]", note: "insumos urgentes", tone: "danger", footer: `${data.insumos.reorden} con reorden sugerido` },
  ] as const;
  const toneClasses = { success: "bg-[#f0fdf4] text-[#15803d]", info: "bg-[#f0f9ff] text-[#0369a1]", warning: "bg-[#fffbeb] text-[#b45309]", danger: "bg-[#fef2f2] text-[#b91c1c]" };

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-semibold tracking-[0.02em] text-[#475569]"><span className="h-1.5 w-1.5 rounded-full bg-[#c25e19]" />Tablero Operativo • Ejercicio actual</span>
            <span className="text-[13px] text-[#94a3b8]">Actualizado hoy</span>
          </div>
          <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em] text-[#0f172a]">Centro de Control Financiero</h1>
          <p className="mt-1 text-base leading-[1.625rem] text-[#475569]">Supervisa los costos reales de tus recetas, alertas críticas de merma e inventario, y asegura la rentabilidad fijada para tu restaurante.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content="Próximamente"><button type="button" disabled className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[#0f172a] shadow-sm"><span className="material-symbols-outlined text-[18px] text-[#475569]">receipt_long</span>Descargar P&amp;L</button></Tooltip>
          <Link href="/recetas" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#c25e19] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#9a3412]"><span className="material-symbols-outlined text-[18px]">add</span>Nueva Receta</Link>
          <Link href="/insumos?tab=compras" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#565e74]"><span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>Registrar Compra</Link>
        </div>
      </section>

      <aside className="overflow-hidden rounded-xl bg-[#ffdbca]/30 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#c25e19]/10 text-[#c25e19]"><span className="material-symbols-outlined text-[22px]">auto_stories</span></span><div><span className="rounded-full bg-[#c25e19]/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#c25e19]">Cultura de Costeo • Concepto Clave</span><h2 className="mt-0.5 text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Cálculo de Food Cost Ideal vs. Real</h2><p className="mt-0.5 max-w-3xl text-sm leading-6 text-[#475569]">Mantener el costo de materia prima entre el <strong>28% y 35%</strong> permite amortiguar overhead y personal. Una desviación sostenida suele indicar mermas operativas o gramajes inexactos.</p></div></div>
          <Link href="/glosario" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#c25e19] shadow-sm">Ver guía interactiva<span className="material-symbols-outlined text-[18px]">arrow_forward</span></Link>
        </div>
      </aside>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => <article key={kpi.label} className="flex flex-col justify-between rounded-xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">{kpi.label}</span><span className={`material-symbols-outlined text-[20px] ${kpi.iconColor}`}>{kpi.icon}</span></div><div className="my-2 flex items-baseline gap-2"><span className={`font-kpi-value ${kpi.valueColor}`}>{kpi.value}</span><span className="text-[13px] font-medium text-[#475569]">{kpi.note}</span></div><span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${toneClasses[kpi.tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{kpi.footer}</span></article>)}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {moduleCards.map((card, index) => <article key={card.title} className="group flex flex-col justify-between rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"><div><span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#0f172a] transition-colors group-hover:bg-[#c25e19] group-hover:text-white"><span className="material-symbols-outlined text-[24px]">{card.icon}</span></span><h3 className="mt-2 text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">{card.title}</h3><p className="mt-1 text-sm leading-6 text-[#475569]">{card.description}</p><p className="mt-2 flex items-center gap-1 text-[13px] text-[#94a3b8]"><span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-[#15803d]" : index === 1 ? "bg-[#c25e19]" : "bg-[#0369a1]"}`} />{index === 0 ? `${data.insumos.total} materias primas • ${data.insumos.conMerma} con merma` : index === 1 ? `${data.recetas.activas} recetas activas • ${data.recetas.aRevisar} requieren revisión` : `Margen obj: ${formatPct(data.finanzas.margenObjetivo)} • Overhead: ${formatPct(data.finanzas.overhead)}`}</p></div><Link href={card.href} className="mt-4 inline-flex w-full items-center justify-between rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#565e74]">{card.action}<span className="material-symbols-outlined text-[18px]">arrow_forward</span></Link></article>)}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7"><AlertasInventarioCard /></div>
        <article className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm lg:col-span-5"><header className="flex items-center justify-between bg-[#f1f5f9]/50 p-6"><div><h3 className="text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Semáforo de Rentabilidad</h3><p className="mt-0.5 text-[13px] text-[#475569]">Estado de recetas clave según margen neto actual</p></div><Link href="/recetas" className="text-xs font-medium text-[#c25e19]">Ver {data.recetas.activas} recetas</Link></header><div className="flex flex-col gap-2 p-4">{data.semaforo.length === 0 ? <p className="p-4 text-sm text-[#94a3b8]">Aún no hay recetas para evaluar.</p> : data.semaforo.slice(0, 3).map((receta) => <Link key={receta.recetaId} href={`/recetas/${receta.recetaId}`} className="rounded-xl bg-[#f1f5f9]/30 p-4"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-[#0f172a]">{receta.nombre}</span><StatusBadge status={receta.estado} /></div><div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-white p-2 text-center shadow-sm"><span><small className="block text-xs font-semibold uppercase text-[#94a3b8]">PVP Carta</small><strong className="text-sm text-[#0f172a]">{receta.pvp === null ? "—" : `$${receta.pvp.toFixed(2)}`}</strong></span><span><small className="block text-xs font-semibold uppercase text-[#94a3b8]">Costo Insumo</small><strong className="text-sm text-[#475569]">${receta.costo.toFixed(2)}</strong></span><span><small className="block text-xs font-semibold uppercase text-[#94a3b8]">Food Cost</small><strong className="text-sm text-[#0f172a]">{formatPct(receta.foodCostPct)}</strong></span></div></Link>)}</div><div className="m-4 mt-auto flex items-start gap-2 rounded-lg bg-[#f0f9ff] p-4 text-[#0369a1]"><span className="material-symbols-outlined mt-0.5 text-[18px]">insights</span><p className="text-[13px]"><strong>Recomendación CalculaChef:</strong> revisa primero las recetas en riesgo y recalibra su PVP o costo de compra.</p></div></article>
      </section>
    </div>
  );
}
