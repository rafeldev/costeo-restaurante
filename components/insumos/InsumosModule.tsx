"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { InsumoDTO } from "@/lib/api-types";
import {
  unidadBaseLabels,
  unidadBaseShort,
  unidadBaseValues,
  type UnidadBaseValue,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { calculateUnitCostFromPurchase } from "@/lib/unit-conversion";
import { insumoSchema } from "@/lib/validation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { toast } from "sonner";

type FormValues = z.input<typeof insumoSchema>;

const defaultValues: FormValues = {
  nombre: "",
  categoria: "",
  unidadBase: "GRAMO",
  costoUnidad: 0,
  mermaPct: 0,
  proveedor: "",
};

export function InsumosModule() {
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [precioCompra, setPrecioCompra] = useState<number>(0);
  const [cantidadCompra, setCantidadCompra] = useState<number>(1);
  const [unidadCompra, setUnidadCompra] = useState<UnidadBaseValue>("KILOGRAMO");
  const [calcError, setCalcError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(insumoSchema),
    defaultValues,
  });
  const unidadBaseSeleccionada = watch("unidadBase");

  async function loadInsumos() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/insumos");
      if (!response.ok) throw new Error("No se pudieron cargar los insumos");
      const data: InsumoDTO[] = await response.json();
      setInsumos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInsumos();
  }, []);

  const totalInsumos = useMemo(() => insumos.length, [insumos]);

  async function onSubmit(values: FormValues) {
    const endpoint = editingId ? `/api/insumos/${editingId}` : "/api/insumos";
    const method = editingId ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo guardar");
    }

    setEditingId(null);
    reset(defaultValues);
    setPrecioCompra(0);
    setCantidadCompra(1);
    setUnidadCompra("KILOGRAMO");
    setCalcError(null);
    await loadInsumos();
    toast.success(editingId ? "Insumo actualizado" : "Insumo creado");
  }

  function requestDelete(id: string) {
    setDeleteConfirmId(id);
  }

  async function onConfirmDelete() {
    const id = deleteConfirmId;
    if (!id) return;
    setDeleteConfirmId(null);
    const response = await fetch(`/api/insumos/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body.message ?? "No se pudo eliminar");
      return;
    }
    await loadInsumos();
    toast.success("Insumo eliminado");
  }

  function startEdit(insumo: InsumoDTO) {
    setEditingId(insumo.id);
    reset({
      nombre: insumo.nombre,
      categoria: insumo.categoria,
      unidadBase: insumo.unidadBase,
      costoUnidad: insumo.costoUnidad,
      mermaPct: insumo.mermaPct,
      proveedor: insumo.proveedor ?? "",
    });
    setPrecioCompra(0);
    setCantidadCompra(1);
    setUnidadCompra(insumo.unidadBase);
    setCalcError(null);
  }

  function calcularCostoUnitario() {
    const costo = calculateUnitCostFromPurchase({
      precioCompra,
      cantidadCompra,
      unidadCompra,
      unidadBase: unidadBaseSeleccionada,
    });
    if (!costo) {
      setCalcError(
        "No se pudo calcular. Verifica valores y que unidad compra/base sean compatibles.",
      );
      return;
    }
    setCalcError(null);
    setValue("costoUnidad", Number(costo.toFixed(6)), { shouldValidate: true });
  }

  const insumoToDelete = deleteConfirmId ? insumos.find((i) => i.id === deleteConfirmId) : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:gap-6">
      <ConfirmModal
        open={!!deleteConfirmId}
        title="Eliminar insumo"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => setDeleteConfirmId(null)}
      >
        {insumoToDelete ? (
          <p>
            Se eliminará <strong>{insumoToDelete.nombre}</strong>.
          </p>
        ) : null}
      </ConfirmModal>
      <section className="surface-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-primary sm:text-lg">
          {editingId ? "Editar insumo" : "Nuevo insumo"}
        </h2>
        <form
          className="mt-4 space-y-3.5"
          onSubmit={handleSubmit(async (values) => {
            try {
              await onSubmit(values);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Error inesperado");
            }
          })}
        >
          <Field label="Nombre" error={errors.nombre?.message}>
            <input className="input" {...register("nombre")} />
          </Field>
          <Field label="Categoría" error={errors.categoria?.message}>
            <input className="input" {...register("categoria")} />
          </Field>
          <Field label="Unidad base" error={errors.unidadBase?.message}>
            <select className="input" {...register("unidadBase")}>
              {unidadBaseValues.map((value) => (
                <option key={value} value={value}>
                  {unidadBaseLabels[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Costo por unidad" error={errors.costoUnidad?.message}>
            <input
              className="input"
              type="number"
              min="0"
              step="0.0001"
              {...register("costoUnidad", { valueAsNumber: true })}
            />
            <span className="mt-1 block text-xs text-secondary">
              Este valor es por {unidadBaseShort[unidadBaseSeleccionada]}.
            </span>
          </Field>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--parchment)] p-3.5">
            <p className="text-sm font-semibold text-primary">Calculadora de costo unitario</p>
            <p className="mt-1 text-xs text-secondary">
              Ingresa cómo compras el insumo y se calculará el costo por unidad base.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs">
                <span className="mb-1 block">Precio de compra</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  value={Number.isFinite(precioCompra) ? precioCompra : 0}
                  onChange={(event) => setPrecioCompra(Number(event.target.value))}
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block">Cantidad</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={Number.isFinite(cantidadCompra) ? cantidadCompra : 0}
                  onChange={(event) => setCantidadCompra(Number(event.target.value))}
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block">Unidad compra</span>
                <select
                  className="input"
                  value={unidadCompra}
                  onChange={(event) =>
                    setUnidadCompra(event.target.value as UnidadBaseValue)
                  }
                >
                  {unidadBaseValues.map((value) => (
                    <option key={value} value={value}>
                      {unidadBaseLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="btn-primary mt-3 inline-flex items-center text-xs"
              onClick={calcularCostoUnitario}
            >
              Calcular y usar costo unitario
            </button>
            {calcError ? <p className="mt-2 text-xs text-[var(--danger-text)]">{calcError}</p> : null}
          </div>
          <Field label="Merma (%)" error={errors.mermaPct?.message}>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              {...register("mermaPct", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Proveedor (opcional)" error={errors.proveedor?.message}>
            <input className="input" {...register("proveedor")} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" isLoading={isSubmitting} loadingLabel="Guardando…">
              {editingId ? "Guardar cambios" : "Crear insumo"}
            </Button>
            {editingId ? (
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  reset(defaultValues);
                  setPrecioCompra(0);
                  setCantidadCompra(1);
                  setUnidadCompra("KILOGRAMO");
                  setCalcError(null);
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="surface-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-primary sm:text-lg">Listado de insumos</h2>
          <span className="text-sm text-secondary">{totalInsumos} registrados</span>
        </div>
        {error ? (
          <div className="mb-4">
            <ErrorState message={error} onRetry={loadInsumos} />
          </div>
        ) : null}
        {isLoading ? <LoadingState message="Cargando insumos…" /> : null}
        {!isLoading && !error && insumos.length === 0 ? (
          <EmptyState
            title="Aún no hay insumos registrados"
            description="Crea el primero con el formulario de la izquierda."
          />
        ) : null}
        {!isLoading && !error && insumos.length > 0 ? (
          <div className="space-y-2">
            {insumos.map((insumo) => (
              <article
                key={insumo.id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--border)] p-3 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <p className="font-medium text-primary">{insumo.nombre}</p>
                  <p className="text-sm text-secondary">
                    {insumo.categoria} · {unidadBaseLabels[insumo.unidadBase]} ·{" "}
                    {formatMoney(insumo.costoUnidad)}/{unidadBaseShort[insumo.unidadBase]} ·
                    {" "}Merma {insumo.mermaPct}%
                  </p>
                  {insumo.inventario ? (
                    <p className="mt-1 text-xs text-muted">
                      Stock: {insumo.inventario.stockActual.toFixed(2)}{" "}
                      {unidadBaseShort[insumo.unidadBase]} · mínimo{" "}
                      {insumo.inventario.stockMinimo.toFixed(2)} · estado{" "}
                      {insumo.inventario.estadoReposicion}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary min-h-10 px-3 py-1.5 text-sm"
                    type="button"
                    onClick={() => startEdit(insumo)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn-danger min-h-10 px-3 py-1.5 text-sm"
                    type="button"
                    onClick={() => requestDelete(insumo.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
