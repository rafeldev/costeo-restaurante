"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { InsumoDTO, MovimientoInventarioDTO } from "@/lib/api-types";
import { Field } from "@/components/ui/Field";
import { tipoMovimientoLabels, tipoMovimientoValues, unidadBaseShort } from "@/lib/domain";
import { movimientoInventarioSchema } from "@/lib/validation";

type MovimientoFormValues = z.input<typeof movimientoInventarioSchema>;

const movimientoDefaults: MovimientoFormValues = {
  insumoId: "",
  tipo: "ENTRADA",
  cantidad: 1,
  motivo: "",
  fechaMovimiento: new Date().toISOString().slice(0, 16),
};

const badgeStyles: Record<"verde" | "amarillo" | "rojo", string> = {
  verde: "bg-emerald-100 text-emerald-800",
  amarillo: "bg-amber-100 text-amber-800",
  rojo: "bg-red-100 text-red-800",
};

export function InventarioModule() {
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventarioDTO[]>([]);
  const [stockMinimoDraft, setStockMinimoDraft] = useState<Record<string, number>>({});
  const [guardandoMinimo, setGuardandoMinimo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MovimientoFormValues>({
    resolver: zodResolver(movimientoInventarioSchema),
    defaultValues: movimientoDefaults,
  });

  async function fetchData() {
    const [insumosRes, movimientosRes] = await Promise.all([
      fetch("/api/insumos"),
      fetch("/api/movimientos-inventario"),
    ]);
    if (!insumosRes.ok || !movimientosRes.ok) {
      throw new Error("No se pudieron cargar datos de inventario");
    }
    const [insumosData, movimientosData]: [InsumoDTO[], MovimientoInventarioDTO[]] =
      await Promise.all([insumosRes.json(), movimientosRes.json()]);
    return { insumosData, movimientosData };
  }

  async function loadData() {
    const { insumosData, movimientosData } = await fetchData();
    setInsumos(insumosData);
    setMovimientos(movimientosData);
    setStockMinimoDraft(
      Object.fromEntries(
        insumosData.map((insumo) => [insumo.id, insumo.inventario?.stockMinimo ?? 0]),
      ),
    );
  }

  useEffect(() => {
    let cancelled = false;
    void fetchData()
      .then(({ insumosData, movimientosData }) => {
        if (cancelled) return;
        setInsumos(insumosData);
        setMovimientos(movimientosData);
        setStockMinimoDraft(
          Object.fromEntries(
            insumosData.map((insumo) => [insumo.id, insumo.inventario?.stockMinimo ?? 0]),
          ),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          alert(error instanceof Error ? error.message : "Error inesperado");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function guardarStockMinimo(insumoId: string) {
    const value = stockMinimoDraft[insumoId] ?? 0;
    setGuardandoMinimo(insumoId);
    try {
      const response = await fetch(`/api/insumos/${insumoId}/inventario`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockMinimo: value }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudo actualizar stock mínimo");
      }
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setGuardandoMinimo(null);
    }
  }

  async function onSubmitMovimiento(values: MovimientoFormValues) {
    const response = await fetch("/api/movimientos-inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo registrar movimiento");
    }
    reset(movimientoDefaults);
    await loadData();
  }

  const totalAlertas = useMemo(
    () =>
      insumos.filter(
        (insumo) =>
          insumo.inventario &&
          (insumo.inventario.estadoReposicion === "rojo" ||
            insumo.inventario.estadoReposicion === "amarillo"),
      ).length,
    [insumos],
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr] xl:gap-6">
      <section className="surface-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Movimiento manual</h2>
        <form
          className="mt-4 space-y-3.5"
          onSubmit={handleSubmit(async (values) => {
            try {
              await onSubmitMovimiento(values);
            } catch (error) {
              alert(error instanceof Error ? error.message : "Error inesperado");
            }
          })}
        >
          <Field label="Insumo" error={errors.insumoId?.message}>
            <select className="input" {...register("insumoId")}>
              <option value="">Selecciona un insumo</option>
              {insumos.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de movimiento" error={errors.tipo?.message}>
            <select className="input" {...register("tipo")}>
              {tipoMovimientoValues.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipoMovimientoLabels[tipo]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cantidad" error={errors.cantidad?.message}>
            <input
              className="input"
              type="number"
              min="0"
              step="0.0001"
              {...register("cantidad", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Motivo (opcional)" error={errors.motivo?.message}>
            <input className="input" {...register("motivo")} />
          </Field>
          <Field label="Fecha" error={errors.fechaMovimiento?.message}>
            <input className="input" type="datetime-local" {...register("fechaMovimiento")} />
          </Field>
          <button className="btn-primary disabled:opacity-50" disabled={isSubmitting} type="submit">
            Registrar movimiento
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <article className="surface-card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Stock por insumo</h2>
          <p className="mt-1 text-sm text-slate-600">
            {insumos.length} insumos · {totalAlertas} alertas activas
          </p>
          <div className="mt-3 space-y-2">
            {insumos.map((insumo) => {
              const estado = insumo.inventario?.estadoReposicion ?? "verde";
              const stockActual = insumo.inventario?.stockActual ?? 0;
              const stockMinimo = insumo.inventario?.stockMinimo ?? 0;
              return (
                <div
                  key={insumo.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 lg:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-800">{insumo.nombre}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${badgeStyles[estado]}`}>
                        {estado}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Stock: {stockActual.toFixed(2)} {unidadBaseShort[insumo.unidadBase]} ·
                      Mínimo: {stockMinimo.toFixed(2)} {unidadBaseShort[insumo.unidadBase]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="input h-10 w-28"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={stockMinimoDraft[insumo.id] ?? 0}
                      onChange={(event) =>
                        setStockMinimoDraft((prev) => ({
                          ...prev,
                          [insumo.id]: Number(event.target.value),
                        }))
                      }
                    />
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => void guardarStockMinimo(insumo.id)}
                      disabled={guardandoMinimo === insumo.id}
                    >
                      Guardar mínimo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="surface-card p-4 sm:p-5">
          <h3 className="text-base font-semibold text-slate-900">Últimos movimientos</h3>
          <div className="mt-3 space-y-2">
            {movimientos.slice(0, 20).map((movimiento) => (
              <div key={movimiento.id} className="rounded-lg border border-slate-200 p-3">
                <p className="font-medium text-slate-800">
                  {movimiento.insumo?.nombre} · {tipoMovimientoLabels[movimiento.tipo]}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Cantidad: {movimiento.cantidad.toFixed(2)}{" "}
                  {movimiento.insumo ? unidadBaseShort[movimiento.insumo.unidadBase] : ""}
                  {" "}· {new Date(movimiento.fechaMovimiento).toLocaleString("es-CO")}
                </p>
                {movimiento.motivo ? (
                  <p className="mt-1 text-xs text-slate-500">Motivo: {movimiento.motivo}</p>
                ) : null}
              </div>
            ))}
            {movimientos.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay movimientos registrados.</p>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
