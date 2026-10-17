"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type {
  AreaAlmacenDTO,
  ConteoInventarioDTO,
  PaginatedResponse,
  TomaInventarioDetalleDTO,
  TomaInventarioResumenDTO,
} from "@/lib/api-types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  categoriaInsumoLabels,
  categoriaInsumoValues,
  motivoVarianzaLabels,
  motivoVarianzaValues,
  unidadBaseShort,
  type MotivoVarianzaValue,
} from "@/lib/domain";
import {
  calcularDiferencia,
  calcularVarianzaPct,
  getEstadoConteo,
} from "@/lib/inventory-reconciliation";

type Draft = { stockFisico: string; motivo: MotivoVarianzaValue | ""; nota: string };

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const estadoLabel: Record<ConteoInventarioDTO["estado"], string> = {
  PENDIENTE: "Pendiente",
  TOLERANCIA: "Tolerancia OK",
  DISCREPANCIA: "Discrepancia",
  CRITICO: "Crítico",
};

const estadoClass: Record<ConteoInventarioDTO["estado"], string> = {
  PENDIENTE: "bg-[var(--control-bg)] text-secondary",
  TOLERANCIA: "bg-[var(--success-surface)] text-[var(--success-text)]",
  DISCREPANCIA: "bg-[var(--warning-surface)] text-[var(--warning-text)]",
  CRITICO: "bg-[var(--danger-surface)] text-[var(--danger-text)]",
};

function Icon({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none align-middle leading-none ${className}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function signedNumber(value: number, digits = 2) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function errorMessage(body: unknown, fallback: string) {
  return typeof body === "object" && body && "message" in body
    ? String((body as { message: unknown }).message)
    : fallback;
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function InventarioModule() {
  const [areas, setAreas] = useState<AreaAlmacenDTO[]>([]);
  const [history, setHistory] = useState<TomaInventarioResumenDTO[]>([]);
  const [toma, setToma] = useState<TomaInventarioDetalleDTO | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [area, setArea] = useState("");
  const [familia, setFamilia] = useState("");
  const [query, setQuery] = useState("");
  const [soloDiscrepancia, setSoloDiscrepancia] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [forceClose, setForceClose] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const draftsRef = useRef(drafts);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const loadShell = useCallback(async () => {
    const [areasResponse, historyResponse] = await Promise.all([
      fetch("/api/areas-almacen", { cache: "no-store" }),
      fetch("/api/tomas-inventario?pageSize=50", { cache: "no-store" }),
    ]);
    if (!areasResponse.ok || !historyResponse.ok) {
      throw new Error("No se pudo cargar la conciliación de inventario");
    }
    const [areasData, historyData]: [AreaAlmacenDTO[], PaginatedResponse<TomaInventarioResumenDTO>] =
      await Promise.all([areasResponse.json(), historyResponse.json()]);
    setAreas(areasData);
    setHistory(historyData.items);
    return historyData.items.find((item) => item.estado === "EN_CURSO")?.id ?? null;
  }, []);

  const loadToma = useCallback(async (id: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (area) params.set("area", area);
    if (familia) params.set("familia", familia);
    if (query.trim()) params.set("q", query.trim());
    if (soloDiscrepancia) params.set("soloDiscrepancia", "true");
    const response = await fetch(`/api/tomas-inventario/${id}?${params}`, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => ({}));
      throw new Error(errorMessage(body, "No se pudo cargar la toma"));
    }
    const detail = (await response.json()) as TomaInventarioDetalleDTO;
    setToma(detail);
    setDrafts((current) => {
      const next = { ...current };
      for (const item of detail.items) {
        next[item.id] = {
          stockFisico: item.stockFisico === null ? "" : String(item.stockFisico),
          motivo: item.motivo ?? "",
          nota: item.nota ?? "",
        };
      }
      return next;
    });
  }, [area, familia, page, query, soloDiscrepancia]);

  useEffect(() => {
    let cancelled = false;
    void loadShell()
      .then((activeId) => {
        if (!cancelled) setSelectedId(activeId);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Error inesperado");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const activeTimers = timers.current;
    return () => {
      cancelled = true;
      for (const timer of activeTimers.values()) clearTimeout(timer);
    };
  }, [loadShell]);

  useEffect(() => {
    if (!selectedId) {
      setToma(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void loadToma(selectedId, controller.signal)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Error inesperado");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedId, loadToma]);

  async function saveRows(ids: string[], notify = false) {
    if (!selectedId || !toma || toma.estado !== "EN_CURSO") return true;
    const conteos = ids.map((id) => {
      const draft = draftsRef.current[id]!;
      return {
        id,
        stockFisico: draft.stockFisico === "" ? null : Number(draft.stockFisico),
        motivo: draft.motivo || null,
        nota: draft.nota || null,
      };
    });
    setSaving(true);
    try {
      const response = await fetch(`/api/tomas-inventario/${selectedId}/conteos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteos, observaciones: toma.observaciones }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => ({}));
        throw new Error(errorMessage(body, "No se pudieron guardar los conteos"));
      }
      if (notify) {
        await loadToma(selectedId);
        toast.success("Progreso guardado");
      }
      return true;
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Error inesperado");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }));
    const previous = timers.current.get(id);
    if (previous) clearTimeout(previous);
    timers.current.set(id, setTimeout(() => {
      timers.current.delete(id);
      void saveRows([id]);
    }, 650));
  }

  async function openAudit() {
    setOpening(true);
    try {
      const response = await fetch("/api/tomas-inventario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: currentPeriod() }),
      });
      if (!response.ok) {
        const errorBody: unknown = await response.json().catch(() => ({}));
        throw new Error(errorMessage(errorBody, "No se pudo abrir la toma"));
      }
      const body = (await response.json()) as { id: string };
      const activeId = String((body as { id: string }).id);
      setSelectedId(activeId);
      await loadShell();
      toast.success("Toma abierta con stock y costos congelados");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Error inesperado");
    } finally {
      setOpening(false);
    }
  }

  async function closeAudit() {
    if (!selectedId || !toma) return;
    const closingToma = toma;
    setSaving(true);
    try {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
      if (!(await saveRows(closingToma.items.map((item) => item.id)))) return;
      setSaving(true);
      const response = await fetch(
        `/api/tomas-inventario/${selectedId}/cerrar${forceClose ? "?forzar=true" : ""}`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => ({}));
        throw new Error(errorMessage(body, "No se pudo cerrar la toma"));
      }
      setShowClose(false);
      setForceClose(false);
      await Promise.all([loadToma(selectedId), loadShell()]);
      toast.success("Inventario conciliado y ajustes aplicados");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !toma) return <LoadingState message="Cargando toma de inventario…" />;
  if (error && !toma) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!toma) {
    return (
      <EmptyState
        title="No hay una toma de inventario en curso"
        description="Abre la auditoría mensual para congelar el stock teórico y comenzar el conteo físico."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-accent" type="button" disabled={opening} onClick={() => void openAudit()}>
              {opening ? "Abriendo…" : `Abrir toma ${currentPeriod()}`}
            </button>
            {history.length > 0 ? (
              <button className="btn-secondary" type="button" onClick={() => {
                setSelectedId(history[0]!.id);
                setShowHistory(true);
              }}>
                Ver historial
              </button>
            ) : null}
          </div>
        }
      />
    );
  }

  const editable = toma.estado === "EN_CURSO";
  const lastClosed = history.find((item) => item.estado === "CERRADA");
  const from = toma.totalFiltrado === 0 ? 0 : (toma.page - 1) * toma.pageSize + 1;
  const to = Math.min(toma.page * toma.pageSize, toma.totalFiltrado);
  const totalPages = Math.max(1, Math.ceil(toma.totalFiltrado / toma.pageSize));
  const areaLabel = areas.find((item) => item.id === area)?.nombre ?? (area === "sin-area" ? "Sin área" : "Todas las áreas");

  return (
    <div className="inventory-print-root -mx-1 space-y-6 text-[var(--ink)] sm:mx-0">

      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-secondary">
            <span className="rounded bg-[#eceef0] px-2.5 py-1 uppercase tracking-[0.08em]">
              Módulo de insumos • Auditoría de existencias
            </span>
            <span className="text-muted">•</span>
            <span>
              {lastClosed?.cerradaEn ? "Último cierre: " : "Periodo: "}
              <strong className="text-primary">
                {lastClosed?.cerradaEn
                  ? new Date(lastClosed.cerradaEn).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })
                  : toma.periodo}
              </strong>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-[-0.025em] sm:text-[2rem] sm:leading-10">
              Toma de Inventario Físico y Conciliación
            </h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${editable ? "bg-[#ffdbca] text-[#773300]" : "bg-[var(--success-surface)] text-[var(--success-text)]"}`}>
              {editable ? "Toma mensual en curso" : "Auditoría cerrada"}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-secondary">
            Registra el conteo real en bodega y cocina, compara contra el stock teórico del sistema y cuantifica el valor económico de las diferencias.
          </p>
        </div>
        <div className="inventory-no-print flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <button className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-white px-4 text-sm font-medium shadow-sm transition hover:bg-slate-50" type="button" onClick={() => window.print()}>
            <Icon className="text-[18px]">print</Icon> Imprimir hoja (PDF)
          </button>
          <button className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-white px-4 text-sm font-medium shadow-sm transition hover:bg-slate-50" type="button" onClick={() => setShowHistory((value) => !value)}>
            <Icon className="text-[18px]">history</Icon> Historial
          </button>
          {editable ? (
            <button className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--ink)] px-5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800" type="button" onClick={() => setShowClose(true)}>
              <Icon className="text-[18px]">task_alt</Icon> Cerrar y ajustar inventario
            </button>
          ) : null}
        </div>
      </header>

      {showHistory ? (
        <section className="inventory-no-print rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-semibold"><Icon className="text-[20px] text-secondary">history</Icon> Historial de tomas</h3>
            <button className="rounded-lg p-2 text-secondary hover:bg-[var(--control-bg)]" type="button" onClick={() => setShowHistory(false)} aria-label="Cerrar historial"><Icon className="text-[20px]">close</Icon></button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {history.map((item) => (
              <button key={item.id} type="button" className={`rounded-lg border p-3 text-left transition ${item.id === selectedId ? "border-[var(--accent)] bg-orange-50" : "border-[var(--border)] hover:bg-slate-50"}`} onClick={() => { setSelectedId(item.id); setPage(1); }}>
                <span className="font-semibold">{item.periodo}</span>
                <span className="mt-1 block text-xs text-secondary">{item.contados}/{item.total} contados · {item.estado === "CERRADA" ? "Cerrada" : "En curso"}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex items-start justify-between gap-6 overflow-hidden rounded-xl border border-sky-200 bg-[#f0f9ff] p-5 shadow-sm">
        <div className="flex max-w-4xl items-start gap-4">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-[#0369a1]"><Icon className="text-2xl">school</Icon></div>
          <div>
            <h3 className="text-base font-semibold">¿Por qué auditar la diferencia entre el Stock Teórico y el Conteo Físico?</h3>
            <p className="mt-1 text-sm leading-6 text-secondary">
              El stock teórico descuenta las producciones y mermas registradas. Una discrepancia negativa puede reflejar mermas no reportadas, sobreporcionamiento o movimientos sin registrar. La conciliación regular evita distorsiones en el costo mensual.
            </p>
            <div className="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-sky-100 bg-white/80 px-3 py-1.5 font-mono text-xs">
              <strong className="text-[#0369a1]">Fórmula clave:</strong>
              <span>Varianza económica = (Stock físico - Stock teórico) × Costo neto real</span>
              <span className="text-muted">|</span>
              <span>% Varianza = (Diferencia / Stock teórico) × 100</span>
            </div>
          </div>
        </div>
        <Link href="/glosario" className="inventory-no-print hidden shrink-0 items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-[#0369a1] shadow-sm transition hover:bg-sky-50 md:inline-flex">
          Guía de bodega <Icon className="text-[18px]">arrow_forward</Icon>
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="flex min-h-44 flex-col justify-between rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-muted"><span>Valor total inventariado</span><Icon className="text-xl">payments</Icon></div>
          <div><p className="text-2xl font-bold tracking-tight sm:text-[1.875rem]">{money.format(toma.kpis.valorInventariado)}</p><p className="mt-1 text-xs text-muted">En {toma.contados} ítems contados físicamente</p></div>
          <div className="flex items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2 text-xs font-medium text-[var(--success-text)]"><Icon className="text-base">verified</Icon> Base valorizada al costo promedio</div>
        </article>
        <article className="flex min-h-44 flex-col justify-between rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-muted"><span>Varianza global neta</span><Icon className="text-xl text-[var(--warning-text)]">trending_down</Icon></div>
          <div><p className="text-2xl font-bold tracking-tight sm:text-[1.875rem]">{money.format(toma.kpis.varianzaGlobalNeta)}</p><p className="mt-1 text-xs text-muted">Impacto directo acumulado en costo</p></div>
          <div className="border-t border-[var(--border-subtle)] pt-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-surface)] px-2 py-1 text-xs font-semibold text-[var(--warning-text)]"><span className="size-1.5 rounded-full bg-current" /> Por conciliar al cierre</span></div>
        </article>
        <article className="flex min-h-44 flex-col justify-between rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-muted"><span>Discrepancias críticas</span><Icon className="text-xl text-[var(--danger-text)]">warning</Icon></div>
          <div><p className="text-2xl font-bold tracking-tight text-[var(--danger-text)] sm:text-[1.875rem]">{toma.kpis.discrepanciasCriticas} insumos</p><p className="mt-1 text-xs text-muted">Requieren justificación del responsable</p></div>
          <div className="border-t border-[var(--border-subtle)] pt-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger-surface)] px-2 py-1 text-xs font-semibold text-[var(--danger-text)]"><span className="size-1.5 rounded-full bg-current" /> Diferencia ≥ {toma.criticoPct}%</span></div>
        </article>
        <article className="flex min-h-44 flex-col justify-between rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-muted"><span>Progreso de conteo</span><Icon className="text-xl">checklist_rtl</Icon></div>
          <div><div className="flex items-baseline justify-between"><p className="text-2xl font-bold tracking-tight sm:text-[1.875rem]">{toma.kpis.progresoPct}%</p><span className="text-xs text-muted">{toma.contados} / {toma.total} contados</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--control-bg)]"><div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${Math.min(100, toma.kpis.progresoPct)}%` }} /></div></div>
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-xs text-secondary"><span>{toma.resumen.pendientes} insumos pendientes</span><strong className="text-[var(--accent)]">{areaLabel}</strong></div>
        </article>
      </section>

      <section className="inventory-no-print rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--control-bg)] p-1" role="tablist" aria-label="Áreas de almacén">
            <button role="tab" aria-selected={area === ""} className={`h-9 shrink-0 rounded-md px-3 text-sm font-medium ${area === "" ? "bg-white font-semibold text-primary shadow-sm" : "text-secondary hover:bg-white/60"}`} type="button" onClick={() => { setArea(""); setPage(1); }}>Todas las áreas ({toma.total})</button>
            {areas.map((item) => <button key={item.id} role="tab" aria-selected={area === item.id} className={`h-9 shrink-0 rounded-md px-3 text-sm font-medium ${area === item.id ? "bg-white font-semibold text-primary shadow-sm" : "text-secondary hover:bg-white/60"}`} type="button" onClick={() => { setArea(item.id); setPage(1); }}>{item.nombre}{item.insumosCount === undefined ? "" : ` (${item.insumosCount})`}</button>)}
            <button role="tab" aria-selected={area === "sin-area"} className={`h-9 shrink-0 rounded-md px-3 text-sm font-medium ${area === "sin-area" ? "bg-white font-semibold text-primary shadow-sm" : "text-secondary hover:bg-white/60"}`} type="button" onClick={() => { setArea("sin-area"); setPage(1); }}>Sin área</button>
          </div>
          <label className="relative block w-full lg:max-w-xs">
            <span className="sr-only">Buscar por nombre, SKU o código</span><Icon className="pointer-events-none absolute left-3 top-2.5 text-xl text-muted">search</Icon>
            <input className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white pl-10 pr-4 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--ring)]" type="search" value={query} placeholder="Buscar por nombre, SKU o código..." onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
          </label>
        </div>
        <div className="my-4 h-px bg-[var(--border-subtle)]" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2"><Icon className="text-lg text-muted">category</Icon><select className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--ring)]" value={familia} onChange={(event) => { setFamilia(event.target.value); setPage(1); }}><option value="">Todas las familias de insumos</option>{categoriaInsumoValues.map((value) => <option key={value} value={value}>{categoriaInsumoLabels[value]}</option>)}</select></div>
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-red-200 bg-[var(--danger-surface)] px-3 text-sm font-medium"><input className="size-4 accent-red-700" type="checkbox" checked={soloDiscrepancia} onChange={(event) => { setSoloDiscrepancia(event.target.checked); setPage(1); }} /> Solo con discrepancia <span className="rounded-full bg-[var(--danger-text)] px-2 py-0.5 text-xs font-bold leading-none text-white">{toma.kpis.discrepanciasCriticas}</span></label>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted"><Icon className="text-base">tune</Icon> Filtros activos: <strong className="text-primary">{areaLabel}</strong></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? <LoadingState className="inventory-no-print" message="Actualizando conciliación…" /> : toma.items.length === 0 ? <EmptyState className="m-4" title="No hay insumos para estos filtros" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-[var(--border-subtle)] bg-[var(--control-bg)] text-[11px] font-semibold uppercase tracking-[0.07em] text-secondary"><th className="px-4 py-3.5">Insumo y ubicación</th><th className="px-4 py-3.5 text-right">Costo unit. neto</th><th className="px-4 py-3.5 text-right">Stock teórico</th><th className="w-52 px-4 py-3.5 text-center">Stock físico (conteo real)</th><th className="px-4 py-3.5 text-right">Diferencia / varianza</th><th className="px-4 py-3.5 text-right">Impacto económico</th><th className="w-64 px-4 py-3.5">Justificación / estado</th><th className="px-4 py-3.5 text-center">Acciones</th></tr></thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {toma.items.map((item) => {
                  const draft = drafts[item.id] ?? { stockFisico: "", motivo: "", nota: "" };
                  const stockFisico = draft.stockFisico === "" ? null : Number(draft.stockFisico);
                  const diferencia = calcularDiferencia(item.stockTeorico, stockFisico);
                  const varianzaPct = calcularVarianzaPct(item.stockTeorico, stockFisico);
                  const impacto = diferencia === null ? null : Number((diferencia * item.costoUnitario).toFixed(2));
                  const estado = getEstadoConteo(item.stockTeorico, stockFisico, toma.toleranciaPct, toma.criticoPct);
                  const isCritical = estado === "CRITICO";
                  const initials = item.nombre.split(/\s+/).slice(0, 3).map((part) => part[0]).join("").toUpperCase();
                  return (
                    <tr key={item.id} className={`align-middle transition-colors hover:bg-slate-50 ${isCritical ? "bg-red-50/40" : ""}`}>
                      <td className="px-4 py-3.5"><div className="flex items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eceef0] text-[11px] font-bold text-secondary">{initials}</div><div><p className="max-w-64 font-semibold leading-tight">{item.nombre}</p><div className="mt-1 flex items-center gap-2 text-xs text-muted"><span>{item.sku ?? item.codigo}</span><span>•</span><span className="rounded bg-[#eceef0] px-2 py-0.5 font-medium text-secondary">{item.area?.nombre ?? "Sin área"} • {categoriaInsumoLabels[item.categoria]}</span></div></div></div></td>
                      <td className="px-4 py-3.5 text-right font-mono"><div className="font-medium">{money.format(item.costoUnitario)} <span className="font-sans text-xs font-normal text-muted">/ {unidadBaseShort[item.unidadBase]}</span></div></td>
                      <td className="px-4 py-3.5 text-right font-mono font-medium text-secondary">{item.stockTeorico.toFixed(4)} {unidadBaseShort[item.unidadBase]}</td>
                      <td className="px-4 py-3.5"><div className="flex items-center justify-center gap-1.5"><div className="relative w-36"><input className={`h-10 w-full rounded-lg bg-white py-1 pl-3 pr-10 text-right font-mono font-semibold outline-none transition focus:ring-3 ${isCritical ? "border-2 border-[var(--danger-text)] focus:ring-red-100" : "border border-[var(--border-strong)] focus:border-[var(--accent)] focus:ring-[var(--ring)]"}`} type="number" min="0" step="0.0001" disabled={!editable} aria-label={`Stock físico de ${item.nombre}`} value={draft.stockFisico} onChange={(event) => updateDraft(item.id, { stockFisico: event.target.value })} /><span className="pointer-events-none absolute right-2.5 top-2.5 text-xs text-muted">{unidadBaseShort[item.unidadBase]}</span></div><span className="flex size-10 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-white text-secondary" title="Conteo físico"><Icon className="text-lg">scale</Icon></span></div></td>
                      <td className="px-4 py-3.5 text-right font-mono"><div className={`font-bold ${diferencia !== null && diferencia < 0 ? "text-[var(--danger-text)]" : "text-primary"}`}>{diferencia === null ? "—" : `${signedNumber(diferencia, 4)} ${unidadBaseShort[item.unidadBase]}`}</div>{diferencia !== null ? <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${estadoClass[estado]}`}>{varianzaPct === null || !Number.isFinite(varianzaPct) ? "∞" : `${signedNumber(varianzaPct)}%`} · {estadoLabel[estado]}</span> : null}</td>
                      <td className={`px-4 py-3.5 text-right font-mono font-bold ${impacto !== null && impacto < 0 ? "text-[var(--danger-text)]" : impacto && impacto > 0 ? "text-[var(--success-text)]" : "text-primary"}`}>{impacto === null ? "—" : money.format(impacto)}</td>
                      <td className="px-4 py-2.5"><select className="h-9 w-full rounded border border-[var(--border-strong)] bg-white px-2 text-xs outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]" disabled={!editable} value={draft.motivo} aria-label={`Motivo de ${item.nombre}`} onChange={(event) => updateDraft(item.id, { motivo: event.target.value as Draft["motivo"] })}><option value="">{estado === "PENDIENTE" ? "Pendiente de conteo" : "Sin justificación"}</option>{motivoVarianzaValues.map((value) => <option key={value} value={value}>{motivoVarianzaLabels[value]}</option>)}</select><input className="mt-1.5 h-8 w-full rounded border border-[var(--border)] bg-white px-2 text-xs outline-none placeholder:text-muted focus:border-[var(--accent)]" disabled={!editable} value={draft.nota} placeholder="Nota opcional" aria-label={`Nota de ${item.nombre}`} onChange={(event) => updateDraft(item.id, { nota: event.target.value })} /></td>
                      <td className="px-4 py-3.5 text-center"><button className="rounded p-2 text-secondary transition hover:bg-[var(--control-bg)] hover:text-primary" type="button" title={item.contadoEn ? `${new Date(item.contadoEn).toLocaleString("es-CO")} · ${item.contadoPor ?? ""}` : "Sin conteo registrado"} aria-label={`Ver trazabilidad de ${item.nombre}`}><Icon className="text-xl">history_edu</Icon></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="inventory-no-print flex flex-col items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--control-bg)] px-4 py-3 text-xs text-secondary sm:flex-row">
          <p>Mostrando <strong className="text-primary">{from}{from !== to ? `–${to}` : ""}</strong> de <strong className="text-primary">{toma.totalFiltrado}</strong> insumos registrados</p>
          <div className="flex items-center gap-1"><button className="rounded border border-[var(--border)] bg-white px-2.5 py-1.5 disabled:cursor-not-allowed disabled:text-muted" type="button" disabled={toma.page <= 1} onClick={() => setPage(toma.page - 1)}>Anterior</button><span className="rounded bg-[var(--ink)] px-3 py-1.5 font-semibold text-white">{toma.page}</span><span className="px-1 text-muted">de {totalPages}</span><button className="rounded border border-[var(--border)] bg-white px-2.5 py-1.5 disabled:cursor-not-allowed disabled:text-muted" type="button" disabled={toma.page >= totalPages} onClick={() => setPage(toma.page + 1)}>Siguiente</button></div>
        </div>
      </section>

      <section className="flex flex-col items-stretch justify-between gap-8 rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm lg:flex-row">
        <div className="flex flex-1 flex-col justify-between gap-4"><div><label className="flex items-center gap-2 text-base font-semibold" htmlFor="inventory-notes"><Icon className="text-xl text-secondary">edit_note</Icon> Observaciones generales de la toma física</label><p className="mt-1 text-xs text-muted">Estas notas quedarán adjuntas permanentemente al ajuste de inventario.</p><textarea id="inventory-notes" className="mt-3 min-h-24 w-full resize-y rounded-lg border border-[var(--border-strong)] bg-[var(--control-bg)] p-3 text-sm outline-none placeholder:text-muted focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--ring)]" disabled={!editable} value={toma.observaciones ?? ""} onChange={(event) => setToma({ ...toma, observaciones: event.target.value })} placeholder="Hallazgos del conteo, incidencias o responsables..." /></div><div className="flex items-center gap-2 text-xs text-muted"><Icon className="text-base text-[var(--success-text)]">lock</Icon> Auditoría firmada electrónicamente por: <strong className="text-primary">{toma.firmadoPor ?? "Responsable de la cuenta"}</strong></div></div>
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--control-bg)] p-4 lg:w-96"><div><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Resumen financiero de la muestra</h3><dl className="mt-2 text-sm"><div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2"><dt className="text-secondary">Total faltantes:</dt><dd className="font-mono font-semibold text-[var(--danger-text)]">{money.format(toma.resumen.faltantes)}</dd></div><div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2"><dt className="text-secondary">Total sobrantes:</dt><dd className="font-mono font-semibold text-[var(--success-text)]">{money.format(toma.resumen.sobrantes)}</dd></div><div className="flex items-center justify-between gap-3 py-3"><dt className="font-bold">Ajuste neto al inventario:</dt><dd className={`font-mono text-lg font-bold ${toma.resumen.ajusteNeto < 0 ? "text-[var(--danger-text)]" : "text-[var(--success-text)]"}`}>{money.format(toma.resumen.ajusteNeto)}</dd></div></dl><p className="text-xs leading-4 text-muted">Pendientes por contar: <strong className="text-primary">{toma.resumen.pendientes}</strong>. El cierre generará los movimientos de ajuste correspondientes.</p></div>{editable ? <div className="inventory-no-print flex flex-col gap-2"><button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 text-sm font-medium shadow-sm" type="button" disabled={saving} onClick={() => void saveRows(toma.items.map((item) => item.id), true)}><Icon className="text-lg">save</Icon>{saving ? "Guardando..." : "Guardar progreso parcial"}</button><button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--accent-hover)]" type="button" disabled={saving} onClick={() => setShowClose(true)}><Icon className="text-lg">verified</Icon>Finalizar auditoría y generar ajuste</button></div> : null}</div>
      </section>

      {editable ? <div className="inventory-no-print sticky bottom-3 z-20 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[var(--border)] bg-white/95 p-3 shadow-lg backdrop-blur"><span className="mr-auto flex items-center gap-2 text-xs text-secondary"><span className={`size-2 rounded-full ${saving ? "animate-pulse bg-[var(--warning-text)]" : "bg-[var(--success-text)]"}`} />{saving ? "Guardando cambios..." : "Guardado automático activo"}</span><button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 text-sm font-medium" type="button" onClick={() => window.print()}><Icon className="text-lg">print</Icon> Imprimir</button><button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--ink)] px-4 text-sm font-semibold text-white" type="button" disabled={saving} onClick={() => setShowClose(true)}><Icon className="text-lg">task_alt</Icon> Cerrar y ajustar</button></div> : null}

      <ConfirmModal
        open={showClose}
        title="Cerrar y ajustar inventario"
        description="Esta acción aplicará al stock actual la diferencia físico − teórico de cada conteo y no se puede editar después."
        confirmLabel={saving ? "Aplicando…" : "Cerrar y aplicar ajustes"}
        variant="danger"
        onCancel={() => { setShowClose(false); setForceClose(false); }}
        onConfirm={() => void closeAudit()}
      >
        {toma.resumen.pendientes > 0 ? (
          <label className="flex items-start gap-2 rounded-lg bg-[var(--warning-surface)] p-3 text-[var(--warning-text)]">
            <input className="mt-0.5" type="checkbox" checked={forceClose} onChange={(event) => setForceClose(event.target.checked)} />
            Forzar cierre omitiendo {toma.resumen.pendientes} conteos pendientes. No generarán ajuste.
          </label>
        ) : (
          <p>Se crearán movimientos AJUSTE con signo y se actualizará el inventario atómicamente.</p>
        )}
      </ConfirmModal>
    </div>
  );
}
