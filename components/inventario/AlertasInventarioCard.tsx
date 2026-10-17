"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AlertaInventarioDTO } from "@/lib/api-types";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

export function AlertasInventarioCard() {
  const [alertas, setAlertas] = useState<AlertaInventarioDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"todas" | "criticas" | "reorden">("todas");

  useEffect(() => {
    async function loadAlertas() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/inventario/alertas");
        if (!response.ok) {
          throw new Error("No se pudieron cargar alertas");
        }
        const data: AlertaInventarioDTO[] = await response.json();
        setAlertas(data.filter((item) => item.estadoReposicion !== "verde"));
      } catch {
        setError("No se pudieron cargar las alertas de inventario.");
      } finally {
        setLoading(false);
      }
    }
    void loadAlertas();
  }, []);

  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-sm">
      <header className="flex flex-col justify-between gap-2 bg-[#f1f5f9]/50 p-6 sm:flex-row sm:items-center">
        <div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#b91c1c]" /><h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Alertas de Inventario y Desabastecimiento</h2></div><p className="mt-0.5 text-[13px] text-[#475569]">Insumos próximos o por debajo del umbral mínimo configurado.</p></div>
        <div className="flex items-center gap-1 rounded-lg bg-white p-1 text-xs font-semibold shadow-sm">
          {(["todas", "criticas", "reorden"] as const).map((key) => {
            const count = key === "todas" ? alertas.length : alertas.filter((item) => item.estado === (key === "criticas" ? "Crítico" : "Reorden")).length;
            return <button key={key} type="button" onClick={() => setTab(key)} className={`rounded px-2.5 py-1 ${tab === key ? "bg-[#0f172a] text-white" : "text-[#475569] hover:bg-[#f1f5f9]"}`}>{key === "todas" ? "Todas" : key === "criticas" ? "Críticas" : "Reorden"} ({count})</button>;
          })}
        </div>
      </header>
      {loading ? (
        <div className="mt-3">
          <LoadingState message="Cargando alertas…" className="py-4" />
        </div>
      ) : null}
      {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
      {!loading && !error && alertas.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sin alertas activas.</p>
      ) : null}
      {!loading && !error && alertas.length > 0 ? (
        <div className="p-6"><div className="space-y-2">
        {alertas.filter((item) => tab === "todas" || (tab === "criticas" ? item.estado === "Crítico" : item.estado === "Reorden")).slice(0, 5).map((alerta) => (
          <div
            key={alerta.insumoId}
            className="flex flex-col justify-between gap-4 rounded-xl bg-[#f1f5f9]/40 p-4 text-sm sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-2"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${alerta.estado === "Crítico" ? "bg-[#fef2f2] text-[#b91c1c]" : "bg-[#fffbeb] text-[#b45309]"}`}><span className="material-symbols-outlined text-[20px]">{alerta.estado === "Crítico" ? "warning" : "schedule"}</span></span><div><div className="flex items-center gap-2"><p className="font-semibold text-[#0f172a]">{alerta.nombre}</p><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${alerta.estado === "Crítico" ? "bg-[#fef2f2] text-[#b91c1c]" : "bg-[#fffbeb] text-[#b45309]"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{alerta.estado}{alerta.desviacionPct === null ? "" : ` (${alerta.desviacionPct.toFixed(0)}%)`}</span></div><p className="mt-0.5 text-[13px] text-[#475569]">Stock actual: <strong>{alerta.stockActual.toFixed(2)}</strong> <span className="mx-2 text-[#94a3b8]">•</span> Mínimo requerido: <strong>{alerta.stockMinimo.toFixed(2)}</strong></p></div></div>
            <Link className="inline-flex min-h-9 items-center gap-1 self-end rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#0f172a] shadow-sm transition-colors hover:bg-[#c25e19] hover:text-white sm:self-center" href={`/insumos?tab=compras&insumoId=${alerta.insumoId}`}><span className="material-symbols-outlined text-[16px]" aria-hidden>add_shopping_cart</span>Pedir</Link>
          </div>
        ))}
          </div></div>
      ) : null}
      <footer className="flex items-center justify-between bg-[#f1f5f9]/20 p-4"><span className="text-[13px] text-[#94a3b8]">Valores cruzados con movimientos de inventario.</span><Link href="/insumos?tab=inventario" className="text-xs font-semibold text-[#c25e19]">Ver kardex de insumos →</Link></footer>
    </article>
  );
}
