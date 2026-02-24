"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProduccionDTO, ProduccionResumenDTO } from "@/lib/api-types";
import { formatMoney } from "@/lib/format";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { toast } from "sonner";

type RangoKey = "hoy" | "semana" | "mes";

function getRangoDates(rango: RangoKey): { desde: string; hasta: string } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (rango === "hoy") {
    return {
      desde: startOfDay.toISOString(),
      hasta: new Date(startOfDay.getTime() + 86400000).toISOString(),
    };
  }
  if (rango === "semana") {
    const day = startOfDay.getDay();
    const monday = new Date(startOfDay.getTime() - ((day === 0 ? 6 : day - 1) * 86400000));
    return {
      desde: monday.toISOString(),
      hasta: new Date(monday.getTime() + 7 * 86400000).toISOString(),
    };
  }
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    desde: startOfMonth.toISOString(),
    hasta: startOfNextMonth.toISOString(),
  };
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  filterRecetaId?: string | null;
};

export function ProduccionesModule({ filterRecetaId }: Props = {}) {
  const [producciones, setProducciones] = useState<ProduccionDTO[]>([]);
  const [resumen, setResumen] = useState<ProduccionResumenDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [rango, setRango] = useState<RangoKey>("hoy");
  const [anularId, setAnularId] = useState<string | null>(null);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [editarUnidades, setEditarUnidades] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRecetaId) params.set("recetaId", filterRecetaId);

      const rangoParams = getRangoDates(rango);

      const [prodRes, resumenRes] = await Promise.all([
        fetch(`/api/producciones?${params.toString()}`),
        fetch(`/api/producciones/resumen?desde=${rangoParams.desde}&hasta=${rangoParams.hasta}`),
      ]);

      if (!prodRes.ok || !resumenRes.ok) {
        throw new Error("No se pudieron cargar las producciones");
      }

      const [prodData, resumenData]: [ProduccionDTO[], ProduccionResumenDTO] =
        await Promise.all([prodRes.json(), resumenRes.json()]);

      setProducciones(prodData);
      setResumen(resumenData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [filterRecetaId, rango]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleAnular() {
    if (!anularId) return;
    const id = anularId;
    setAnularId(null);
    try {
      const res = await fetch(`/api/producciones/${id}/anular`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudo anular");
      }
      toast.success("Producción anulada y stock restaurado");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    }
  }

  async function handleEditar() {
    if (!editarId) return;
    const id = editarId;
    setEditarId(null);
    try {
      const res = await fetch(`/api/producciones/${id}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidades: editarUnidades }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudo editar");
      }
      toast.success("Producción corregida");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    }
  }

  const filterRecetaNombre = useMemo(() => {
    if (!filterRecetaId || producciones.length === 0) return null;
    return producciones.find((p) => p.recetaId === filterRecetaId)?.recetaNombre ?? null;
  }, [producciones, filterRecetaId]);

  const produccionToAnular = anularId ? producciones.find((p) => p.id === anularId) : null;

  return (
    <div className="space-y-4">
      <ConfirmModal
        open={!!anularId}
        title="Anular producción"
        description="Se restaurará el stock de los insumos descontados."
        confirmLabel="Anular"
        variant="danger"
        onConfirm={() => void handleAnular()}
        onCancel={() => setAnularId(null)}
      >
        {produccionToAnular ? (
          <p>
            Se anulará la producción de <strong>{produccionToAnular.recetaNombre}</strong>{" "}
            ({produccionToAnular.unidades} unidades). El stock negativo puede quedar si ya se consumió.
          </p>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={!!editarId}
        title="Editar producción"
        description="Se anulará la producción actual y se creará una nueva con las unidades corregidas."
        confirmLabel="Guardar corrección"
        onConfirm={() => void handleEditar()}
        onCancel={() => setEditarId(null)}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-primary">Nuevas unidades</span>
          <input
            className="input"
            type="number"
            min="1"
            step="1"
            value={editarUnidades}
            onChange={(e) => setEditarUnidades(Number(e.target.value))}
          />
        </label>
      </ConfirmModal>

      {filterRecetaId && filterRecetaNombre ? (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--parchment)] px-3 py-2 text-sm">
          <span className="text-secondary">
            Mostrando producciones de <strong className="text-primary">{filterRecetaNombre}</strong>
          </span>
          <Link
            href="/producciones"
            className="ml-auto shrink-0 text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Quitar filtro
          </Link>
        </div>
      ) : null}

      {!filterRecetaId ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-primary">Resumen</h2>
            {(["hoy", "semana", "mes"] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  rango === r
                    ? "bg-[var(--ink)] text-white"
                    : "bg-[var(--parchment)] text-secondary hover:text-primary"
                }`}
                onClick={() => setRango(r)}
              >
                {r === "hoy" ? "Hoy" : r === "semana" ? "Esta semana" : "Este mes"}
              </button>
            ))}
          </div>
          {resumen ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard label="Producciones" value={String(resumen.totalProducciones)} />
              <MetricCard label="Unidades" value={String(resumen.totalUnidades)} />
              <MetricCard label="Costo materia prima" value={formatMoney(resumen.costoTotalMP)} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="surface-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-primary sm:text-lg">Historial</h2>
          <span className="text-sm text-secondary">{producciones.length} registros</span>
        </div>

        {loading ? <LoadingState message="Cargando producciones…" /> : null}

        {!loading && producciones.length === 0 ? (
          <EmptyState
            title="Sin producciones registradas"
            description={
              filterRecetaId
                ? "Esta receta no tiene producciones todavía."
                : "Registra tu primera producción desde el detalle de una receta."
            }
          />
        ) : null}

        {!loading && producciones.length > 0 ? (
          <div className="space-y-2">
            {producciones.map((p) => {
              const isAnulada = p.estado === "ANULADA";
              return (
                <article
                  key={p.id}
                  className={`grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[1fr_auto] md:items-center ${
                    isAnulada
                      ? "border-[var(--danger-border)] bg-red-50/40 opacity-75"
                      : "border-[var(--border)]"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.recetaId ? (
                        <Link
                          href={`/recetas/${p.recetaId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {p.recetaNombre}
                        </Link>
                      ) : (
                        <span className="font-medium text-primary">{p.recetaNombre}</span>
                      )}
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          isAnulada
                            ? "bg-red-100 text-red-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {p.estado}
                      </span>
                    </div>
                    <p className="text-sm text-secondary">
                      {formatFecha(p.fechaProduccion)} · {p.unidades} unidad{p.unidades === 1 ? "" : "es"} · Costo MP: {formatMoney(p.costoTotalProduccion)}
                    </p>
                  </div>
                  {!isAnulada ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary min-h-10 px-3 py-1.5 text-sm"
                        onClick={() => {
                          setEditarId(p.id);
                          setEditarUnidades(p.unidades);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-danger min-h-10 px-3 py-1.5 text-sm"
                        onClick={() => setAnularId(p.id)}
                      >
                        Anular
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-primary">{value}</p>
    </div>
  );
}
