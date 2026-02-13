"use client";

import { useEffect } from "react";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ConfigCosteoDTO } from "@/lib/api-types";
import { configuracionCosteoSchema } from "@/lib/validation";
import { Field } from "@/components/ui/Field";
import { toast } from "sonner";

type FormValues = {
  overheadPct: number;
  margenObjetivoPct: number;
  impuestoPct: number;
  redondeoPrecio: number;
};

export function ConfiguracionModule() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(configuracionCosteoSchema),
    defaultValues: {
      overheadPct: 15,
      margenObjetivoPct: 40,
      impuestoPct: 19,
      redondeoPrecio: 100,
    },
  });

  const loadConfig = useCallback(async () => {
    const response = await fetch("/api/configuracion-costeo");
    if (!response.ok) {
      throw new Error("No se pudo cargar la configuración");
    }
    const data: ConfigCosteoDTO = await response.json();
    reset({
      overheadPct: data.overheadPct,
      margenObjetivoPct: data.margenObjetivoPct,
      impuestoPct: data.impuestoPct,
      redondeoPrecio: data.redondeoPrecio,
    });
  }, [reset]);

  useEffect(() => {
    void loadConfig().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Error inesperado");
    });
  }, [loadConfig]);

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/configuracion-costeo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo guardar");
    }
    await loadConfig();
  }

  return (
    <section className="surface-card max-w-xl p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Parámetros globales</h2>
      <form
        className="mt-4 space-y-3.5"
        onSubmit={handleSubmit(async (values) => {
          try {
            await onSubmit(values);
            toast.success("Configuración guardada");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error inesperado");
          }
        })}
      >
        <Field label="Costos indirectos / overhead (%)" error={errors.overheadPct?.message}>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            {...register("overheadPct", { valueAsNumber: true })}
          />
        </Field>
        <Field
          label="Margen objetivo de utilidad (%)"
          error={errors.margenObjetivoPct?.message}
        >
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            {...register("margenObjetivoPct", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Impuesto (%)" error={errors.impuestoPct?.message}>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            {...register("impuestoPct", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Redondeo de precio" error={errors.redondeoPrecio?.message}>
          <input
            className="input"
            type="number"
            min="1"
            step="1"
            {...register("redondeoPrecio", { valueAsNumber: true })}
          />
        </Field>
        <button
          className="btn-primary disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          Guardar configuración
        </button>
      </form>
    </section>
  );
}
