"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CosteoDTO, InsumoDTO, RecetaDTO } from "@/lib/api-types";
import { unidadBaseShort } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { recetaSchema } from "@/lib/validation";
import { Field } from "@/components/ui/Field";

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

export function RecetasModule() {
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [recetas, setRecetas] = useState<RecetaDTO[]>([]);
  const [semaforos, setSemaforos] = useState<Record<string, CosteoDTO["semaforoRentabilidad"]>>(
    {},
  );
  const [loading, setLoading] = useState(false);

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

  const totalRecetas = useMemo(() => recetas.length, [recetas]);

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
      alert(error instanceof Error ? error.message : "Error inesperado");
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
  }

  async function deleteReceta(id: string) {
    const ok = window.confirm("¿Eliminar esta receta?");
    if (!ok) return;

    const response = await fetch(`/api/recetas/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      alert(body.message ?? "No se pudo eliminar");
      return;
    }
    await loadData();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[400px_1fr] lg:gap-6">
      <section className="surface-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Nueva receta</h2>
        <p className="mt-1 text-sm text-slate-600">
          Crea recetas usando insumos ya registrados.
        </p>
        <form
          className="mt-4 space-y-3.5"
          onSubmit={handleSubmit(async (values) => {
            try {
              await onSubmit(values);
            } catch (error) {
              alert(error instanceof Error ? error.message : "Error inesperado");
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
              <h3 className="font-medium">Ingredientes</h3>
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
            <p className="mt-1 text-xs text-slate-500">
              La cantidad se registra en la unidad base definida en cada insumo.
            </p>
            {errors.ingredientes?.message ? (
              <p className="mt-1 text-xs text-red-600">{errors.ingredientes.message}</p>
            ) : null}
          </div>

          <button
            className="btn-primary disabled:opacity-50"
            type="submit"
            disabled={isSubmitting}
          >
            Guardar receta
          </button>
        </form>
      </section>

      <section className="surface-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Listado de recetas</h2>
          <span className="text-sm text-slate-600">{totalRecetas} recetas</span>
        </div>
        {loading ? <p className="text-sm text-slate-600">Cargando...</p> : null}
        {!loading && recetas.length === 0 ? (
          <p className="text-sm text-slate-600">Aún no hay recetas creadas.</p>
        ) : null}
        <div className="space-y-2">
          {recetas.map((receta) => {
            const semaforo = semaforos[receta.id] ?? "sin_precio";
            return (
              <article
                key={receta.id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <p className="font-medium text-slate-900">{receta.nombre}</p>
                  <p className="text-sm text-slate-600">
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
                    onClick={() => void deleteReceta(receta.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BadgeSemaforo({ value }: { value: CosteoDTO["semaforoRentabilidad"] }) {
  const styles: Record<CosteoDTO["semaforoRentabilidad"], string> = {
    verde: "bg-emerald-100 text-emerald-800",
    amarillo: "bg-amber-100 text-amber-800",
    rojo: "bg-red-100 text-red-800",
    sin_precio: "bg-slate-100 text-slate-700",
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
