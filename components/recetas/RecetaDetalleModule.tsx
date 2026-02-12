"use client";

import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CosteoDTO, InsumoDTO, RecetaDTO } from "@/lib/api-types";
import { unidadBaseShort } from "@/lib/domain";
import { formatMoney, formatPercent } from "@/lib/format";
import { recetaSchema } from "@/lib/validation";
import { Field } from "@/components/ui/Field";

type Props = {
  recetaId: string;
};

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

export function RecetaDetalleModule({ recetaId }: Props) {
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [costeo, setCosteo] = useState<CosteoDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    control,
    reset,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recetaSchema),
    defaultValues: {
      nombre: "",
      tipoProducto: "",
      rendimientoPorciones: 1,
      tiempoPreparacionMin: undefined,
      precioVentaActual: undefined,
      ingredientes: [{ insumoId: "", cantidad: 1 }],
    },
  });

  const ingredientsFieldArray = useFieldArray({
    control,
    name: "ingredientes",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [insumosResponse, recetaResponse, costeoResponse] = await Promise.all([
        fetch("/api/insumos"),
        fetch(`/api/recetas/${recetaId}`),
        fetch(`/api/recetas/${recetaId}/costeo`),
      ]);

      if (!insumosResponse.ok || !recetaResponse.ok || !costeoResponse.ok) {
        throw new Error("No se pudieron cargar los datos de la receta");
      }

      const [insumosData, recetaData, costeoData]: [InsumoDTO[], RecetaDTO, CosteoDTO] =
        await Promise.all([
          insumosResponse.json(),
          recetaResponse.json(),
          costeoResponse.json(),
        ]);

      setInsumos(insumosData);
      setCosteo(costeoData);
      reset({
        nombre: recetaData.nombre,
        tipoProducto: recetaData.tipoProducto,
        rendimientoPorciones: recetaData.rendimientoPorciones,
        tiempoPreparacionMin: recetaData.tiempoPreparacionMin ?? undefined,
        precioVentaActual: recetaData.precioVentaActual ?? undefined,
        ingredientes:
          recetaData.ingredientes?.map((item) => ({
            insumoId: item.insumoId,
            cantidad: item.cantidad,
          })) ?? [{ insumoId: "", cantidad: 1 }],
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [recetaId, reset]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function onSubmit(values: RecipeFormValues) {
    const response = await fetch(`/api/recetas/${recetaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo actualizar la receta");
    }
    await loadData();
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Cargando detalle...</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[400px_1fr] lg:gap-6">
      <section className="surface-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Editar receta</h2>
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
          <Field label="Rendimiento porciones" error={errors.rendimientoPorciones?.message}>
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
          <Field label="Precio venta actual" error={errors.precioVentaActual?.message}>
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
                Agregar
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
                      className="btn-danger min-h-11 px-3 text-xs"
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
          </div>
          <button
            className="btn-primary disabled:opacity-50"
            type="submit"
            disabled={isSubmitting}
          >
            Guardar cambios
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <article className="surface-card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Resultado de costeo</h2>
          {costeo ? (
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Metric label="Costo materia prima" value={formatMoney(costeo.costoMateriaPrima)} />
              <Metric label="Costo total" value={formatMoney(costeo.costoTotal)} />
              <Metric label="Costo por porción" value={formatMoney(costeo.costoPorPorcion)} />
              <Metric
                label="Precio sugerido sin impuesto"
                value={formatMoney(costeo.precioSugeridoSinImpuesto)}
              />
              <Metric
                label="Precio sugerido final"
                value={formatMoney(costeo.precioSugeridoFinal)}
              />
              <Metric
                label="Margen real"
                value={
                  costeo.margenRealPct === null
                    ? "No disponible"
                    : formatPercent(costeo.margenRealPct)
                }
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No hay datos de costeo.</p>
          )}
        </article>

        <article className="surface-card p-4 sm:p-5">
          <h3 className="text-base font-semibold">Desglose por ingrediente</h3>
          {!costeo || costeo.desgloseIngredientes.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Sin ingredientes para mostrar.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {costeo.desgloseIngredientes.map((item) => (
                <div
                  key={item.insumoId}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <p className="font-medium">{item.nombre}</p>
                  <p className="text-sm text-slate-600">Cantidad: {item.cantidad}</p>
                  <p className="text-sm text-slate-600">
                    Costo unidad: {formatMoney(item.costoUnitario)}
                  </p>
                  <p className="text-sm text-slate-700">
                    Costo aplicado: {formatMoney(item.costoAplicado)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-base font-semibold">{value}</p>
    </div>
  );
}
