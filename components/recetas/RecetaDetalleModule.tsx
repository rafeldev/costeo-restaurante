"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CosteoDTO, InsumoDTO, ProduccionDTO, RecetaDTO } from "@/lib/api-types";
import { unidadBaseShort } from "@/lib/domain";
import { formatMoney, formatPercent } from "@/lib/format";
import { recetaSchema } from "@/lib/validation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Field } from "@/components/ui/Field";
import { LoadingState } from "@/components/ui/LoadingState";
import { toast } from "sonner";

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
  const [producciones, setProducciones] = useState<ProduccionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [unidadesProduccion, setUnidadesProduccion] = useState(1);
  const [isProducing, setIsProducing] = useState(false);
  const [showProducirConfirm, setShowProducirConfirm] = useState(false);

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
      const [insumosResponse, recetaResponse, costeoResponse, produccionesResponse] =
        await Promise.all([
          fetch("/api/insumos"),
          fetch(`/api/recetas/${recetaId}`),
          fetch(`/api/recetas/${recetaId}/costeo`),
          fetch(`/api/producciones?recetaId=${recetaId}`),
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

      const produccionesData: ProduccionDTO[] = produccionesResponse.ok
        ? await produccionesResponse.json()
        : [];

      setInsumos(insumosData);
      setCosteo(costeoData);
      setProducciones(produccionesData);
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
      toast.error(error instanceof Error ? error.message : "Error inesperado");
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
    toast.success("Receta actualizada");
  }

  async function registrarProduccion() {
    if (!Number.isInteger(unidadesProduccion) || unidadesProduccion <= 0) {
      toast.error("Las unidades producidas deben ser un número entero mayor a cero");
      return;
    }

    setIsProducing(true);
    try {
      const response = await fetch(`/api/recetas/${recetaId}/producir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidades: unidadesProduccion }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudo registrar la producción");
      }

      toast.success("Producción registrada y stock actualizado");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsProducing(false);
    }
  }

  if (loading) {
    return <LoadingState message="Cargando detalle de receta…" />;
  }

  const recetaNombre = watch("nombre");

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-sm text-secondary">
        <Link href="/recetas" className="hover:text-primary underline">
          Recetas
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary">{recetaNombre || "…"}</span>
      </nav>

      <ConfirmModal
        open={showProducirConfirm}
        title="Registrar producción"
        description="Se descontarán los insumos del inventario según esta receta."
        confirmLabel="Registrar producción"
        onConfirm={() => {
          setShowProducirConfirm(false);
          void registrarProduccion();
        }}
        onCancel={() => setShowProducirConfirm(false)}
      >
        <p>
          Unidades a producir: <strong>{unidadesProduccion}</strong>. Si no alcanza el stock, la
          operación puede dejar saldos negativos.
        </p>
      </ConfirmModal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[400px_1fr] lg:gap-6">
      <section className="surface-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-primary sm:text-lg">Editar receta</h2>
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
            <p className="mt-1 text-xs text-muted">
              La cantidad se registra en la unidad base definida en cada insumo.
            </p>
          </div>
          <button
            className="btn-primary disabled:opacity-50"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <article className="surface-card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-primary sm:text-lg">Resultado de costeo</h2>
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
            <p className="mt-2 text-sm text-secondary">No hay datos de costeo.</p>
          )}
        </article>

        <article className="surface-card p-4 sm:p-5">
          <h3 className="text-base font-semibold text-primary">Registrar producción</h3>
          <p className="mt-1 text-sm text-secondary">
            Descuenta insumos del inventario según ingredientes y merma de esta receta.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm">
              <span className="mb-1 block font-medium text-primary">Unidades producidas</span>
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={unidadesProduccion}
                onChange={(event) => setUnidadesProduccion(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              className="btn-primary inline-flex items-center justify-center disabled:opacity-50"
              onClick={() => {
                if (!Number.isInteger(unidadesProduccion) || unidadesProduccion <= 0) {
                  toast.error("Las unidades producidas deben ser un número entero mayor a cero");
                  return;
                }
                setShowProducirConfirm(true);
              }}
              disabled={isProducing}
            >
              {isProducing ? "Registrando…" : "Registrar producción"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Si no alcanza stock, la operación se permite y puede dejar saldos negativos.
          </p>
        </article>

        <article className="surface-card p-4 sm:p-5">
          <h3 className="text-base font-semibold text-primary">Desglose por ingrediente</h3>
          {!costeo || costeo.desgloseIngredientes.length === 0 ? (
            <p className="mt-2 text-sm text-secondary">Sin ingredientes para mostrar.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {costeo.desgloseIngredientes.map((item) => (
                <div
                  key={item.insumoId}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <p className="font-medium text-primary">{item.nombre}</p>
                  <p className="text-sm text-secondary">Cantidad: {item.cantidad}</p>
                  <p className="text-sm text-secondary">
                    Costo unidad: {formatMoney(item.costoUnitario)}
                  </p>
                  <p className="text-sm text-primary">
                    Costo aplicado: {formatMoney(item.costoAplicado)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="surface-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-primary">Historial de producción</h3>
            {producciones.length > 10 ? (
              <Link
                href={`/producciones?recetaId=${recetaId}`}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Ver todas ({producciones.length})
              </Link>
            ) : null}
          </div>
          {producciones.length === 0 ? (
            <p className="mt-2 text-sm text-secondary">
              Aún no se ha registrado producción para esta receta.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {producciones.slice(0, 10).map((p) => {
                const isAnulada = p.estado === "ANULADA";
                return (
                  <div
                    key={p.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm ${
                      isAnulada
                        ? "border-[var(--danger-border)] bg-red-50/40 opacity-75"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-secondary">
                        {new Date(p.fechaProduccion).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-medium text-primary">
                        {p.unidades} ud.
                      </span>
                      <span className="text-secondary">
                        {formatMoney(p.costoTotalProduccion)}
                      </span>
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
                  </div>
                );
              })}
              {producciones.length > 10 ? (
                <Link
                  href={`/producciones?recetaId=${recetaId}`}
                  className="mt-1 inline-block text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  Ver todas en Producciones →
                </Link>
              ) : null}
            </div>
          )}
        </article>
      </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-base font-semibold text-primary">{value}</p>
    </div>
  );
}
