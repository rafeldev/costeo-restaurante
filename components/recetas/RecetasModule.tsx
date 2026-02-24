"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CosteoDTO, InsumoDTO, RecetaDTO } from "@/lib/api-types";
import { unidadBaseShort } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { recetaSchema } from "@/lib/validation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { LoadingState } from "@/components/ui/LoadingState";
import { toast } from "sonner";

type RecipeFormValues = {
  nombre: string;
  tipoProducto: string;
  rendimientoPorciones: number;
  tiempoPreparacionMin?: number;
  precioVentaActual?: number;
  ingredientes: Array<{
    insumoId: string;
    cantidad: number;
  }>;
};

const defaultValues: RecipeFormValues = {
  nombre: "",
  tipoProducto: "Hamburguesa",
  rendimientoPorciones: 1,
  tiempoPreparacionMin: undefined,
  precioVentaActual: undefined,
  ingredientes: [{ insumoId: "", cantidad: 1 }],
};

type RecetasModuleProps = {
  filterInsumoId?: string | null;
};

export function RecetasModule({ filterInsumoId }: RecetasModuleProps = {}) {
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [recetas, setRecetas] = useState<RecetaDTO[]>([]);
  const [semaforos, setSemaforos] = useState<Record<string, CosteoDTO["semaforoRentabilidad"]>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recetaSchema),
    defaultValues,
  });

  const ingredientsFieldArray = useFieldArray({
    control,
    name: "ingredientes",
  });

  const filteredRecetas = useMemo(() => {
    if (!filterInsumoId) return recetas;
    return recetas.filter((r) =>
      r.ingredientes?.some((ing) => ing.insumoId === filterInsumoId),
    );
  }, [recetas, filterInsumoId]);

  const filterInsumoNombre = useMemo(() => {
    if (!filterInsumoId) return null;
    return insumos.find((i) => i.id === filterInsumoId)?.nombre ?? null;
  }, [insumos, filterInsumoId]);

  const totalRecetas = useMemo(() => filteredRecetas.length, [filteredRecetas]);

  async function loadData() {
    setLoading(true);
    try {
      const [insumosResponse, recetasResponse] = await Promise.all([
        fetch("/api/insumos"),
        fetch("/api/recetas"),
      ]);
      if (!insumosResponse.ok || !recetasResponse.ok) {
        throw new Error("No se pudieron cargar datos iniciales");
      }
      const [insumosData, recetasData]: [InsumoDTO[], RecetaDTO[]] = await Promise.all([
        insumosResponse.json(),
        recetasResponse.json(),
      ]);
      setInsumos(insumosData);
      setRecetas(recetasData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    async function loadSemaforos() {
      const entries = await Promise.all(
        recetas.map(async (receta) => {
          try {
            const response = await fetch(`/api/recetas/${receta.id}/costeo`);
            if (!response.ok) return [receta.id, "sin_precio"] as const;
            const data: CosteoDTO = await response.json();
            return [receta.id, data.semaforoRentabilidad] as const;
          } catch {
            return [receta.id, "sin_precio"] as const;
          }
        }),
      );
      setSemaforos(Object.fromEntries(entries));
    }
    if (recetas.length > 0) {
      void loadSemaforos();
    }
  }, [recetas]);

  async function onSubmit(values: RecipeFormValues) {
    const response = await fetch("/api/recetas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo crear la receta");
    }

    reset(defaultValues);
    await loadData();
    toast.success("Receta creada");
  }

  function requestDeleteReceta(id: string) {
    setDeleteConfirmId(id);
  }

  async function onConfirmDeleteReceta() {
    const id = deleteConfirmId;
    if (!id) return;
    setDeleteConfirmId(null);
    const response = await fetch(`/api/recetas/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body.message ?? "No se pudo eliminar");
      return;
    }
    await loadData();
    toast.success("Receta eliminada");
  }

  const recetaToDelete = deleteConfirmId ? recetas.find((r) => r.id === deleteConfirmId) : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[400px_1fr] lg:gap-6">
      <ConfirmModal
        open={!!deleteConfirmId}
        title="Eliminar receta"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => void onConfirmDeleteReceta()}
        onCancel={() => setDeleteConfirmId(null)}
      >
        {recetaToDelete ? (
          <p>
            Se eliminará la receta <strong>{recetaToDelete.nombre}</strong>.
          </p>
        ) : null}
      </ConfirmModal>
      <section className="surface-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-primary sm:text-lg">Nueva receta</h2>
        <p className="mt-1 text-sm text-secondary">
          Crea recetas usando insumos ya registrados.
        </p>
        <form
          className="mt-4 space-y-3.5"
          onSubmit={handleSubmit(async (values) => {
            try {
              await onSubmit(values);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Error inesperado");
            }
          })}
        >
          <Field label="Nombre" error={errors.nombre?.message}>
            <input className="input" {...register("nombre")} />
          </Field>
          <Field label="Tipo de producto" error={errors.tipoProducto?.message}>
            <input className="input" {...register("tipoProducto")} />
          </Field>
          <Field label="Rendimiento (porciones)" error={errors.rendimientoPorciones?.message}>
            <input
              className="input"
              type="number"
              min="1"
              {...register("rendimientoPorciones", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Tiempo preparación (min)" error={errors.tiempoPreparacionMin?.message}>
            <input
              className="input"
              type="number"
              min="1"
              {...register("tiempoPreparacionMin", {
                setValueAs: (value) => (value === "" ? undefined : Number(value)),
              })}
            />
          </Field>
          <Field label="Precio venta actual (opcional)" error={errors.precioVentaActual?.message}>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              {...register("precioVentaActual", {
                setValueAs: (value) => (value === "" ? undefined : Number(value)),
              })}
            />
          </Field>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium text-primary">Ingredientes</h3>
              <button
                type="button"
                className="btn-secondary min-h-9 px-2.5 py-1 text-xs"
                onClick={() => ingredientsFieldArray.append({ insumoId: "", cantidad: 1 })}
              >
                Agregar ingrediente
              </button>
            </div>
            <div className="space-y-2">
              {ingredientsFieldArray.fields.map((field, index) => {
                const selectedInsumoId = watch(`ingredientes.${index}.insumoId`);
                const selectedInsumo = insumos.find((item) => item.id === selectedInsumoId);
                const unidad = selectedInsumo ? unidadBaseShort[selectedInsumo.unidadBase] : "";
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]"
                  >
                    <select
                      className="input"
                      {...register(`ingredientes.${index}.insumoId` as const)}
                    >
                      <option value="">Selecciona insumo</option>
                      {insumos.map((insumo) => (
                        <option key={insumo.id} value={insumo.id}>
                          {insumo.nombre}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.0001"
                      placeholder={unidad ? `Cantidad en ${unidad}` : "Cantidad"}
                      {...register(`ingredientes.${index}.cantidad` as const, {
                        valueAsNumber: true,
                      })}
                    />
                    <button
                      type="button"
                      className="btn-danger min-h-11 px-3 text-xs sm:px-2"
                      onClick={() => ingredientsFieldArray.remove(index)}
                      disabled={ingredientsFieldArray.fields.length === 1}
                    >
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted">
              La cantidad se registra en la unidad base definida en cada insumo.
            </p>
            {errors.ingredientes?.message ? (
              <p className="mt-1 text-xs text-[var(--danger-text)]">{errors.ingredientes.message}</p>
            ) : null}
          </div>

          <button
            className="btn-primary disabled:opacity-50"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Guardando…" : "Guardar receta"}
          </button>
        </form>
      </section>

      <section className="surface-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-primary sm:text-lg">Listado de recetas</h2>
          <span className="text-sm text-secondary">{totalRecetas} recetas</span>
        </div>
        {filterInsumoId && filterInsumoNombre ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--parchment)] px-3 py-2 text-sm">
            <span className="text-secondary">
              Mostrando recetas que usan <strong className="text-primary">{filterInsumoNombre}</strong>
            </span>
            <Link
              href="/recetas"
              className="ml-auto shrink-0 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Quitar filtro
            </Link>
          </div>
        ) : null}
        {loading ? <LoadingState message="Cargando recetas…" /> : null}
        {!loading && filteredRecetas.length === 0 ? (
          <EmptyState
            title={filterInsumoId ? "No hay recetas con este insumo" : "Aún no hay recetas creadas"}
            description={filterInsumoId ? "Este insumo no se usa en ninguna receta todavía." : "Crea la primera con el formulario de la izquierda."}
          />
        ) : null}
        {!loading && filteredRecetas.length > 0 ? (
          <div className="space-y-2">
            {filteredRecetas.map((receta) => {
              const semaforo = semaforos[receta.id] ?? "sin_precio";
              return (
                <article
                  key={receta.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--border)] p-3 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-medium text-primary">{receta.nombre}</p>
                    <p className="text-sm text-secondary">
                      {receta.tipoProducto} · {receta.rendimientoPorciones} porciones ·{" "}
                      {receta.precioVentaActual
                        ? `Precio actual: ${formatMoney(receta.precioVentaActual)}`
                        : "Sin precio actual"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BadgeSemaforo value={semaforo} />
                    <Link
                      href={`/recetas/${receta.id}`}
                      className="btn-secondary min-h-10 px-3 py-1.5 text-sm"
                    >
                      Ver detalle
                    </Link>
                    <button
                      type="button"
                      className="btn-danger min-h-10 px-3 py-1.5 text-sm"
                      onClick={() => requestDeleteReceta(receta.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function BadgeSemaforo({ value }: { value: CosteoDTO["semaforoRentabilidad"] }) {
  const styles: Record<CosteoDTO["semaforoRentabilidad"], string> = {
    verde: "bg-emerald-100 text-emerald-800",
    amarillo: "bg-amber-100 text-amber-800",
    rojo: "bg-red-100 text-red-800",
    sin_precio: "bg-[var(--control-bg)] text-secondary",
  };
  const label: Record<CosteoDTO["semaforoRentabilidad"], string> = {
    verde: "Rentable",
    amarillo: "Ajustar",
    rojo: "Riesgo",
    sin_precio: "Sin precio",
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles[value]}`}>
      {label[value]}
    </span>
  );
}
