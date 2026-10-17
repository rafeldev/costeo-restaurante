"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { AreaAlmacenDTO, InsumoDTO, MovimientoInventarioDTO } from "@/lib/api-types";
import { unidadBaseShort } from "@/lib/domain";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

type LockState = { bloqueado: boolean; tomaId: string | null; periodo: string | null };

const field = "h-11 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]";

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "No se pudo completar la operación");
  return body as T;
}

export function InventorySetupModule() {
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [areas, setAreas] = useState<AreaAlmacenDTO[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventarioDTO[]>([]);
  const [lock, setLock] = useState<LockState>({ bloqueado: false, tomaId: null, periodo: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [areaNombre, setAreaNombre] = useState("");
  const [movement, setMovement] = useState({ insumoId: "", tipo: "ENTRADA", cantidad: "", motivo: "Saldo inicial" });

  const load = useCallback(async () => {
    setError("");
    try {
      const [insumosResponse, areasResponse, movimientosResponse, lockResponse] = await Promise.all([
        fetch("/api/insumos/opciones"),
        fetch("/api/areas-almacen"),
        fetch("/api/movimientos-inventario"),
        fetch("/api/inventario/estado"),
      ]);
      const [insumosData, areasData, movimientosData, lockData] = await Promise.all([
        responseJson<InsumoDTO[]>(insumosResponse),
        responseJson<AreaAlmacenDTO[]>(areasResponse),
        responseJson<MovimientoInventarioDTO[]>(movimientosResponse),
        responseJson<LockState>(lockResponse),
      ]);
      setInsumos(insumosData);
      setAreas(areasData);
      setMovimientos(movimientosData);
      setLock(lockData);
      setMovement((current) => ({ ...current, insumoId: current.insumoId || insumosData[0]?.id || "" }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la configuración");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createArea(event: React.FormEvent) {
    event.preventDefault();
    try {
      await responseJson(await fetch("/api/areas-almacen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: areaNombre, orden: areas.length + 1 }),
      }));
      setAreaNombre("");
      toast.success("Área creada");
      await load();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "No se pudo crear el área");
    }
  }

  async function saveSetup(insumoId: string, stockMinimo: number, areaId: string | null) {
    try {
      await responseJson(await fetch(`/api/insumos/${insumoId}/inventario`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockMinimo, areaId }),
      }));
      toast.success("Configuración actualizada");
      await load();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "No se pudo actualizar");
    }
  }

  async function registerMovement(event: React.FormEvent) {
    event.preventDefault();
    try {
      await responseJson(await fetch("/api/movimientos-inventario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...movement, cantidad: Number(movement.cantidad) }),
      }));
      setMovement((current) => ({ ...current, cantidad: "", motivo: current.tipo === "ENTRADA" ? "Saldo inicial" : "" }));
      toast.success("Movimiento registrado");
      await load();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "No se pudo registrar el movimiento");
    }
  }

  if (loading) return <LoadingState message="Cargando configuración de inventario…" />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} />;

  return (
    <div className="space-y-6">
      {lock.bloqueado ? <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">La toma {lock.periodo} está abierta. Puedes editar áreas y mínimos, pero no registrar movimientos hasta cerrarla.</div> : null}

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Áreas de almacén</h2>
        <p className="mt-1 text-sm text-muted">Organiza los insumos para conteos y responsables.</p>
        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={createArea}>
          <input className={`${field} flex-1`} value={areaNombre} onChange={(event) => setAreaNombre(event.target.value)} placeholder="Ej. Cámara fría" minLength={2} required />
          <button className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white" type="submit">Crear área</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">{areas.map((area) => <span key={area.id} className="rounded-full bg-[var(--control-bg)] px-3 py-1.5 text-sm">{area.nombre} · {area.insumosCount ?? 0}</span>)}</div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Stock mínimo y ubicación</h2>
        <div className="mt-4 space-y-3">{insumos.map((insumo) => <InsumoSetup key={insumo.id} insumo={insumo} areas={areas} onSave={saveSetup} />)}</div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <form className="rounded-xl bg-white p-5 shadow-sm" onSubmit={registerMovement}>
          <h2 className="text-lg font-semibold text-primary">Movimiento manual</h2>
          <p className="mt-1 text-sm text-muted">Usa Entrada y “Saldo inicial” para cargar la existencia de apertura.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select aria-label="Insumo" className={`${field} sm:col-span-2`} value={movement.insumoId} onChange={(event) => setMovement({ ...movement, insumoId: event.target.value })} required>{insumos.map((insumo) => <option key={insumo.id} value={insumo.id}>{insumo.codigo} · {insumo.nombre}</option>)}</select>
            <select aria-label="Tipo de movimiento" className={field} value={movement.tipo} onChange={(event) => setMovement({ ...movement, tipo: event.target.value, motivo: event.target.value === "ENTRADA" ? "Saldo inicial" : "" })}><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajuste firmado</option></select>
            <input aria-label="Cantidad" className={field} type="number" step="0.0001" value={movement.cantidad} onChange={(event) => setMovement({ ...movement, cantidad: event.target.value })} required />
            <input aria-label="Motivo" className={`${field} sm:col-span-2`} value={movement.motivo} onChange={(event) => setMovement({ ...movement, motivo: event.target.value })} minLength={2} maxLength={200} required />
          </div>
          <button className="mt-4 h-11 w-full rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={lock.bloqueado || !insumos.length}>Registrar movimiento</button>
        </form>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-primary">Últimos movimientos</h2>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">{movimientos.slice(0, 20).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--control-bg)] p-3 text-sm"><div><strong>{item.insumo?.nombre}</strong><p className="text-xs text-muted">{item.motivo || item.tipo}</p></div><span className="font-mono">{item.tipo === "SALIDA" ? "-" : "+"}{item.cantidad} {item.insumo ? unidadBaseShort[item.insumo.unidadBase] : ""}</span></div>)}</div>
        </div>
      </section>
    </div>
  );
}

function InsumoSetup({ insumo, areas, onSave }: { insumo: InsumoDTO; areas: AreaAlmacenDTO[]; onSave: (id: string, minimum: number, areaId: string | null) => Promise<void> }) {
  const [minimum, setMinimum] = useState(String(insumo.inventario?.stockMinimo ?? 0));
  const [areaId, setAreaId] = useState(insumo.areaId ?? "");
  return <div className="grid items-center gap-2 rounded-lg bg-[var(--control-bg)] p-3 sm:grid-cols-[minmax(0,1fr)_130px_180px_auto]"><div><strong className="text-sm">{insumo.nombre}</strong><p className="text-xs text-muted">Actual: {insumo.inventario?.stockActual ?? 0} {unidadBaseShort[insumo.unidadBase]}</p></div><input aria-label={`Stock mínimo de ${insumo.nombre}`} className={field} type="number" min="0" step="0.0001" value={minimum} onChange={(event) => setMinimum(event.target.value)} /><select aria-label={`Área de ${insumo.nombre}`} className={field} value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">Sin área</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select><button type="button" className="h-11 rounded-lg bg-white px-4 text-sm font-semibold shadow-sm" onClick={() => void onSave(insumo.id, Number(minimum), areaId || null)}>Guardar</button></div>;
}
