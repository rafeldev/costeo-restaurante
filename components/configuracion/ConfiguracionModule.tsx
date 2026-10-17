"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type {
  ConfigCosteoDTO,
  ConfiguracionAuditoriaDTO,
  PaginatedResponse,
  RecetaCatalogoDTO,
  SimulacionCosteoDTO,
} from "@/lib/api-types";
import {
  regimenTributarioLabels,
  regimenTributarioValues,
  type RegimenTributarioValue,
} from "@/lib/domain";
import { calculateSuggestedPrice } from "@/lib/pricing/calculateSuggestedPrice";
import { configuracionCosteoSchema } from "@/lib/validation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Tooltip } from "@/components/ui/Tooltip";
import type { z } from "zod";

type FormValues = z.output<typeof configuracionCosteoSchema>;

const DEFAULT_VALUES: FormValues = {
  overheadPct: 12,
  margenObjetivoPct: 56.2,
  regimenTributario: "IMPOCONSUMO_8",
  redondeoPrecio: 100,
  foodCostCriticoPct: 35,
  margenMinimoPct: 40,
  alertaVolatilidadActiva: true,
  umbralVolatilidadPct: 15,
  toleranciaInventarioPct: 2,
  criticoInventarioPct: 5,
};

const IMPUESTO_POR_REGIMEN: Record<RegimenTributarioValue, number> = {
  IMPOCONSUMO_8: 8,
  IVA_19: 19,
  EXENTO: 0,
};

const FIELD_LABELS: Record<string, string> = {
  overheadPct: "Overhead",
  margenObjetivoPct: "Margen objetivo",
  regimenTributario: "Régimen tributario",
  impuestoPct: "Impuesto",
  redondeoPrecio: "Política de redondeo",
  foodCostCriticoPct: "Food cost crítico",
  margenMinimoPct: "Margen mínimo",
  alertaVolatilidadActiva: "Alertas de volatilidad",
  umbralVolatilidadPct: "Umbral de volatilidad",
  toleranciaInventarioPct: "Tolerancia de inventario",
  criticoInventarioPct: "Inventario crítico",
};

const MONEY_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 2,
});
const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const cardClass = "rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6";
const insetClass = "rounded-xl bg-[#f1f5f9] p-4";
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c25e19]/30";

function Icon({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined select-none ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-[#b91c1c]" role="alert">{message}</p> : null;
}

function formatMoney(value: number) {
  return MONEY_FORMATTER.format(value);
}

function displayAuditValue(field: string, value: string) {
  if (field === "regimenTributario") {
    return regimenTributarioLabels[value as RegimenTributarioValue] ?? value;
  }
  if (field === "alertaVolatilidadActiva") return value === "true" ? "Activas" : "Inactivas";
  if (field === "redondeoPrecio") return value === "0" ? "Sin redondeo" : `$${value}`;
  return `${value} %`;
}

function calculateSimulation(values: FormValues, simulation: SimulacionCosteoDTO | null) {
  if (!simulation) return null;
  try {
    return calculateSuggestedPrice({
      costoMateriaPrima: simulation.costoMateriaPrima,
      rendimientoPorciones: simulation.receta.rendimientoPorciones,
      overheadPct: values.overheadPct,
      margenObjetivoPct: values.margenObjetivoPct,
      impuestoPct: IMPUESTO_POR_REGIMEN[values.regimenTributario],
      redondeoPrecio: values.redondeoPrecio,
    });
  } catch {
    return null;
  }
}

export function ConfiguracionModule() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audit, setAudit] = useState<ConfiguracionAuditoriaDTO[]>([]);
  const [recipes, setRecipes] = useState<RecetaCatalogoDTO[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [simulation, setSimulation] = useState<SimulacionCosteoDTO | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(configuracionCosteoSchema), defaultValues: DEFAULT_VALUES });
  const values = watch();

  const applyConfig = useCallback((data: ConfigCosteoDTO) => {
    reset({
      overheadPct: data.overheadPct,
      margenObjetivoPct: data.margenObjetivoPct,
      regimenTributario: data.regimenTributario,
      redondeoPrecio: data.redondeoPrecio as FormValues["redondeoPrecio"],
      foodCostCriticoPct: data.foodCostCriticoPct,
      margenMinimoPct: data.margenMinimoPct,
      alertaVolatilidadActiva: data.alertaVolatilidadActiva,
      umbralVolatilidadPct: data.umbralVolatilidadPct,
      toleranciaInventarioPct: data.toleranciaInventarioPct,
      criticoInventarioPct: data.criticoInventarioPct,
    });
  }, [reset]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [configResponse, auditResponse, recipesResponse] = await Promise.all([
        fetch("/api/configuracion-costeo", { cache: "no-store" }),
        fetch("/api/configuracion-costeo/auditoria?limit=20", { cache: "no-store" }),
        fetch("/api/recetas?page=1&pageSize=100", { cache: "no-store" }),
      ]);
      if (!configResponse.ok || !auditResponse.ok || !recipesResponse.ok) {
        throw new Error("No se pudo cargar la configuración.");
      }
      const [config, history, recipeData] = await Promise.all([
        configResponse.json() as Promise<ConfigCosteoDTO>,
        auditResponse.json() as Promise<{ items: ConfiguracionAuditoriaDTO[] }>,
        recipesResponse.json() as Promise<PaginatedResponse<RecetaCatalogoDTO>>,
      ]);
      applyConfig(config);
      setAudit(history.items);
      setRecipes(recipeData.items);
      setSelectedRecipeId((current) => current || recipeData.items[0]?.id || "");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  const refreshAudit = useCallback(async () => {
    const response = await fetch("/api/configuracion-costeo/auditoria?limit=20", { cache: "no-store" });
    if (response.ok) {
      const data: { items: ConfiguracionAuditoriaDTO[] } = await response.json();
      setAudit(data.items);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedRecipeId) {
      setSimulation(null);
      return;
    }
    const controller = new AbortController();
    setSimulationLoading(true);
    fetch(`/api/configuracion-costeo/simulacion?recetaId=${encodeURIComponent(selectedRecipeId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo simular esta receta.");
        setSimulation(await response.json());
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") toast.error(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSimulationLoading(false);
      });
    return () => controller.abort();
  }, [selectedRecipeId]);

  async function onSubmit(formValues: FormValues) {
    const response = await fetch("/api/configuracion-costeo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message ?? "No se pudo guardar la configuración.");
    }
    const body: ConfigCosteoDTO = await response.json();
    applyConfig(body);
    await refreshAudit();
  }

  async function restoreDefaults() {
    setRestoring(true);
    try {
      const response = await fetch("/api/configuracion-costeo/restaurar", { method: "POST" });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message ?? "No se pudieron restaurar los valores.");
      }
      const body: ConfigCosteoDTO = await response.json();
      applyConfig(body);
      await refreshAudit();
      setRestoreOpen(false);
      toast.success("Valores predeterminados restaurados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) return <LoadingState message="Cargando parámetros y calibraciones…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => void loadData()} />;

  const localSimulation = calculateSimulation(values, simulation);
  const taxPct = IMPUESTO_POR_REGIMEN[values.regimenTributario];
  const activeRecipes = recipes.filter((recipe) => recipe.activa).length;
  const directCost = localSimulation?.costoPorPorcion ?? 0;
  const subtotal = localSimulation?.precioSugeridoSinImpuesto ?? 0;
  const overheadCash = subtotal * values.overheadPct / 100;
  const marginCash = subtotal * values.margenObjetivoPct / 100;
  const taxCash = subtotal * taxPct / 100;
  const exactTotal = subtotal + taxCash;
  const totalPortions = directCost + overheadCash + marginCash + taxCash;
  const foodPct = subtotal > 0 ? directCost / subtotal * 100 : 0;
  const barWidth = (amount: number) => totalPortions > 0 ? `${amount / totalPortions * 100}%` : "0%";
  const roundingLabels: Record<number, string> = {
    0: "Sin redondeo comercial",
    50: "Redondeado al 50 superior",
    100: "Redondeado a centena superior",
    1000: "Redondeado al millar superior",
  };

  return (
    <div className="configuration-stitch-root -mx-2 w-[calc(100%+1rem)] text-[#191c1e]">
      <style>{`
        main:has(.configuration-stitch-root) > header { display: none; }
        .configuration-stitch-root .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 450, 'GRAD' 0, 'opsz' 24; line-height: 1; }
        .configuration-stitch-root input[type='range'] { accent-color: #c25e19; }
      `}</style>

      <form
        className="flex flex-col gap-6"
        onSubmit={handleSubmit(async (formValues) => {
          try {
            await onSubmit(formValues);
            toast.success("Configuración guardada");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error inesperado.");
          }
        })}
      >
        <section className={`${cardClass} flex flex-col justify-between gap-5 md:flex-row md:items-end`}>
          <div className="max-w-3xl">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-semibold tracking-[0.02em] text-[#475569]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c25e19]" />
                PARÁMETROS DEL SISTEMA · Ajustes Globales v2.4
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f0fdf4] px-2 py-1 text-xs font-semibold text-[#15803d]">
                <Icon className="text-[14px]">lock_reset</Icon> Motor en Sincronía
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-[-0.025em] text-[#0f172a] sm:text-[2rem] sm:leading-10">
              Configuración de Costeo y Márgenes
            </h1>
            <p className="mt-1 text-sm leading-6 text-[#475569]">
              Define los coeficientes macroeconómicos que gobiernan el cálculo del Precio de Venta Sugerido (PVP), absorción de costos fijos y política tributaria para todas las recetas activas del restaurante.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button type="button" className={`${focusClass} inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[#f1f5f9] px-4 text-sm font-medium text-[#0f172a] shadow-sm transition hover:bg-[#e0e3e5]`} onClick={() => setRestoreOpen(true)}>
              <Icon className="text-[18px]">replay</Icon> Restaurar Valores
            </button>
            <button type="submit" disabled={isSubmitting} className={`${focusClass} inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[#0f172a] px-5 text-sm font-medium text-white shadow-md transition hover:bg-[#334155] disabled:opacity-60`}>
              <Icon className="text-[18px]">check_circle</Icon> {isSubmitting ? "Guardando…" : "Guardar Configuración"}
            </button>
          </div>
        </section>

        <section className="flex flex-col items-start justify-between gap-5 rounded-xl bg-[#f0f9ff] p-4 shadow-sm sm:p-6 lg:flex-row lg:items-center">
          <div className="flex max-w-3xl items-start gap-4">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0369a1]/10 text-[#0369a1]">
              <Icon className="text-2xl">school</Icon>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0369a1]">
                Cultura de Costeo · Concepto Maestro
                <span className="hidden normal-case tracking-normal sm:inline">· PVP Proporcional Inverso</span>
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">La Regla del Precio de Venta Sugerido (PVP Gastronómico)</h2>
              <p className="mt-1 text-sm leading-6 text-[#475569]">
                Un error clásico es sumar linealmente el margen sobre el costo de compra. CalculaChef utiliza la fórmula de <em>Mark-up de Fondo Cero</em>, garantizando cobertura total antes de calcular tributos.
              </p>
              <div className="mt-2 overflow-x-auto rounded-lg bg-white p-2.5 font-mono text-xs text-[#0f172a] shadow-sm">
                <strong className="mr-2 text-[#c25e19]">Fórmula Activa:</strong>
                PVP = [ Costo Directo ÷ (1 - %Overhead - %Margen Objetivo) ] × (1 + %Impuesto)
              </div>
              {explainerOpen ? (
                <p className="mt-2 text-xs leading-5 text-[#0369a1]">El denominador reserva simultáneamente la cuota operativa y la utilidad. El impuesto se incorpora después para no erosionar el margen neto objetivo.</p>
              ) : null}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row lg:flex-col">
            <Link href="/glosario" className={`${focusClass} inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-[#0369a1] shadow-sm transition hover:bg-[#f8fafc]`}>
              <Icon className="text-[18px]">menu_book</Icon> Glosario Gastronómico
            </Link>
            <button type="button" aria-expanded={explainerOpen} className={`${focusClass} inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0369a1]/10 px-4 text-sm font-medium text-[#0369a1] transition hover:bg-[#0369a1]/20`} onClick={() => setExplainerOpen((open) => !open)}>
              <Icon className="text-[18px]">insights</Icon> {explainerOpen ? "Ocultar Desglose" : "Ver Desglose Teórico"}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-7">
            <section className={`${cardClass} flex flex-col gap-6`} data-tour="config-parametros">
              <div className="flex items-center justify-between gap-4 pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="text-[22px] text-[#c25e19]">tune</Icon>
                  <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Parámetros Globales de Costeo</h2>
                </div>
                <span className="shrink-0 text-xs font-semibold text-[#94a3b8]">Aplica a: {activeRecipes} Recetas</span>
              </div>

              <div className={`${insetClass} flex flex-col gap-2`}>
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="overheadPct" className="text-sm font-medium text-[#0f172a]">
                      Costos Indirectos de Fabricación / Overhead
                    </label>
                    <Tooltip label="Ayuda sobre costos indirectos" className="h-8 w-8 items-center justify-center" content="Es el porcentaje reservado para pagar gastos que no son ingredientes, como arriendo, energía, gas y limpieza. El sistema reparte ese costo entre todas tus recetas.">
                      <Icon className="cursor-help text-base text-[#64748b]">help</Icon>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <input id="overheadPct" className={`${focusClass} h-9 w-20 rounded-lg bg-white px-2 text-right font-mono text-sm font-bold text-[#0f172a] shadow-sm`} type="number" min="5" max="30" step="0.1" {...register("overheadPct", { valueAsNumber: true })} />
                    <span className="text-sm font-bold text-[#475569]">%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#94a3b8]">5%</span>
                  <input className="h-8 w-full cursor-pointer" type="range" min="5" max="30" step="0.1" aria-label="Overhead en porcentaje" value={values.overheadPct} onChange={(event) => setValue("overheadPct", Number(event.target.value), { shouldValidate: true, shouldDirty: true })} />
                  <span className="font-mono text-xs text-[#94a3b8]">30%</span>
                </div>
                <div className="flex items-start gap-2 pt-1 text-[13px] leading-5 text-[#475569]">
                  <Icon className="mt-0.5 shrink-0 text-[18px] text-[#c25e19]">tips_and_updates</Icon>
                  <p><strong className="text-[#0f172a]">Rango recomendado: 10.0% - 18.0%.</strong> Prorratea energía, arrendamiento y personal de limpieza según la rotación de tu cocina.</p>
                </div>
                <FieldError message={errors.overheadPct?.message} />
              </div>

              <div className={`${insetClass} flex flex-col gap-2`}>
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="margenObjetivoPct" className="text-sm font-medium text-[#0f172a]">
                      Margen Objetivo de Utilidad Neta
                    </label>
                    <Tooltip label="Ayuda sobre margen objetivo" className="h-8 w-8 items-center justify-center" content="Es la parte del precio que quieres conservar como ganancia después de cubrir ingredientes y gastos indirectos. El sistema usa este porcentaje para calcular el precio sugerido.">
                      <Icon className="cursor-help text-base text-[#64748b]">help</Icon>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <input id="margenObjetivoPct" className={`${focusClass} h-9 w-20 rounded-lg bg-white px-2 text-right font-mono text-sm font-bold text-[#0f172a] shadow-sm`} type="number" min="0" max="90" step="0.1" {...register("margenObjetivoPct", { valueAsNumber: true })} />
                    <span className="text-sm font-bold text-[#475569]">%</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1" aria-label="Atajos de margen">
                  {[
                    [40, "40% Menú Ejecutivo"],
                    [56.2, "56.2% Estándar Bistro"],
                    [65, "65% Platos Estrella"],
                    [75, "75% Coctelería & Bar"],
                  ].map(([margin, label]) => {
                    const selected = values.margenObjetivoPct === margin;
                    return (
                      <button key={margin} type="button" className={`${focusClass} rounded-lg px-3 py-1.5 text-xs shadow-sm transition ${selected ? "bg-[#c25e19] font-semibold text-white" : "bg-white font-medium text-[#475569] hover:bg-[#f8fafc]"}`} onClick={() => setValue("margenObjetivoPct", Number(margin), { shouldValidate: true, shouldDirty: true })}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-start gap-2 pt-1 text-[13px] leading-5 text-[#475569]">
                  <Icon className="mt-0.5 shrink-0 text-[18px] text-[#0369a1]">info</Icon>
                  <p>Margen libre tras absorber materia prima y gastos fijos directos. El promedio bistró opera entre el 50% y 65%.</p>
                </div>
                <FieldError message={errors.margenObjetivoPct?.message} />
              </div>

              <div className={`${insetClass} flex flex-col gap-3`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[#0f172a]">Régimen Tributario Aplicable (Impuesto al Consumo / IVA)</span>
                  <span className="rounded bg-white px-2 py-1 font-mono text-xs font-bold text-[#0f172a] shadow-sm">{taxPct.toFixed(1)}%</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {regimenTributarioValues.map((regime) => {
                    const detail = regime === "IMPOCONSUMO_8" ? "Gastronomía nacional" : regime === "IVA_19" ? "Eventos / Catering" : "Régimen simple";
                    return (
                      <label key={regime} className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white p-3 shadow-sm transition hover:bg-[#f8fafc]">
                        <input className="accent-[#c25e19]" type="radio" value={regime} {...register("regimenTributario")} />
                        <span className="flex flex-col">
                          <span className="text-xs font-bold text-[#0f172a]">{regimenTributarioLabels[regime]}</span>
                          <span className="text-[11px] text-[#94a3b8]">{detail}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[13px] leading-5 text-[#94a3b8]">Se aplica sobre la base gravable generada antes de exponer el precio final de venta al público (PVP Carta).</p>
                <FieldError message={errors.regimenTributario?.message} />
              </div>

              <div className={`${insetClass} flex flex-col gap-2`}>
                <label htmlFor="redondeoPrecio" className="flex items-center justify-between text-sm font-medium text-[#0f172a]">
                  Política de Redondeo Comercial de Carta
                  <Icon className="text-base text-[#94a3b8]">price_change</Icon>
                </label>
                <select id="redondeoPrecio" className={`${focusClass} h-11 w-full rounded-lg bg-white px-3 text-sm font-medium text-[#0f172a] shadow-sm`} {...register("redondeoPrecio", { valueAsNumber: true })}>
                  <option value={100}>Redondear al alza a la centena más cercana (ej: $13.412 → $13.500)</option>
                  <option value={50}>Redondear al cincuenta más cercano (ej: $13.412 → $13.450)</option>
                  <option value={1000}>Redondear al millar entero (ej: $13.412 → $14.000)</option>
                  <option value={0}>Sin redondeo comercial (mantener valor exacto)</option>
                </select>
                <p className="text-[13px] leading-5 text-[#475569]">Facilita el arqueo de caja físico y mejora la legibilidad gráfica del menú impreso y código QR.</p>
                <FieldError message={errors.redondeoPrecio?.message} />
              </div>

              <div className="flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
                <button type="button" className={`${focusClass} inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] transition hover:text-[#0f172a]`} onClick={() => setAuditOpen((open) => !open)}>
                  <Icon className="text-[18px]">history</Icon> Auditar {audit.length} cambios recientes
                </button>
                <button type="submit" disabled={isSubmitting} className={`${focusClass} inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#c25e19] px-10 text-sm font-medium text-white shadow-md transition hover:bg-[#9a3412] disabled:opacity-60 sm:w-auto`}>
                  <Icon className="text-[18px]">save</Icon> {isSubmitting ? "Guardando…" : "Guardar Cambios"}
                </button>
              </div>
            </section>

            <section className={`${cardClass} flex flex-col gap-4`}>
              <div className="flex items-center gap-2 pb-1">
                <Icon className="text-[22px] text-[#b45309]">notification_important</Icon>
                <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Políticas de Alerta de Merma y Margen</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={`${insetClass} flex flex-col gap-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="foodCostCriticoPct" className="text-sm font-medium text-[#0f172a]">Food Cost Crítico</label>
                    <span className="rounded bg-[#fef2f2] px-2 py-0.5 font-mono text-xs font-bold text-[#b91c1c]">&gt; {values.foodCostCriticoPct.toFixed(1)}%</span>
                  </div>
                  <p className="text-[13px] leading-5 text-[#94a3b8]">Activa badge rojo en escandallo cuando la materia prima sobrepase este umbral.</p>
                  <input id="foodCostCriticoPct" className="h-8 w-full cursor-pointer accent-[#b91c1c]" type="range" min="25" max="45" step="0.1" value={values.foodCostCriticoPct} onChange={(event) => setValue("foodCostCriticoPct", Number(event.target.value), { shouldDirty: true, shouldValidate: true })} />
                  <input type="hidden" {...register("foodCostCriticoPct", { valueAsNumber: true })} />
                  <FieldError message={errors.foodCostCriticoPct?.message} />
                </div>
                <div className={`${insetClass} flex flex-col gap-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="margenMinimoPct" className="text-sm font-medium text-[#0f172a]">Margen Mínimo Aprobado</label>
                    <span className="rounded bg-[#fffbeb] px-2 py-0.5 font-mono text-xs font-bold text-[#b45309]">&lt; {values.margenMinimoPct.toFixed(1)}%</span>
                  </div>
                  <p className="text-[13px] leading-5 text-[#94a3b8]">Revisa el precio sugerido y confirma el estándar antes de publicarlo en tu carta.</p>
                  <input id="margenMinimoPct" className="h-8 w-full cursor-pointer accent-[#b45309]" type="range" min="30" max="55" step="0.1" value={values.margenMinimoPct} onChange={(event) => setValue("margenMinimoPct", Number(event.target.value), { shouldDirty: true, shouldValidate: true })} />
                  <input type="hidden" {...register("margenMinimoPct", { valueAsNumber: true })} />
                  <FieldError message={errors.margenMinimoPct?.message} />
                </div>
              </div>
              <div className={`${insetClass} flex flex-col justify-between gap-4 sm:flex-row sm:items-center`}>
                <div className="flex items-center gap-3">
                  <Icon className="text-[22px] text-[#0369a1]">mail</Icon>
                  <div>
                    <p className="text-sm font-medium text-[#0f172a]">Alertas por volatilidad de compra</p>
                    <p className="text-[13px] leading-5 text-[#94a3b8]">Enviar email cuando un insumo clave aumente más del umbral definido.</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <label className="flex items-center gap-1 font-mono text-xs font-bold text-[#475569]">
                    <input className={`${focusClass} h-8 w-14 rounded-lg bg-white px-2 text-right shadow-sm`} type="number" min="0.1" max="100" step="0.1" disabled={!values.alertaVolatilidadActiva} aria-label="Umbral de volatilidad" {...register("umbralVolatilidadPct", { valueAsNumber: true })} /> %
                  </label>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input className="peer sr-only" type="checkbox" role="switch" aria-label="Activar alertas por volatilidad de compra" {...register("alertaVolatilidadActiva")} />
                    <span className="h-6 w-11 rounded-full bg-[#e0e3e5] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#15803d] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[#15803d]/30" />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 border-t border-[#e2e8f0] pt-4 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3 text-[13px] text-[#475569]">Tolerancia de inventario
                  <span className="flex items-center gap-1"><input className={`${focusClass} h-9 w-20 rounded-lg bg-[#f1f5f9] px-2 text-right font-mono font-bold text-[#0f172a]`} type="number" min="0" max="100" step="0.1" {...register("toleranciaInventarioPct", { valueAsNumber: true })} />%</span>
                </label>
                <label className="flex items-center justify-between gap-3 text-[13px] text-[#475569]">Inventario crítico
                  <span className="flex items-center gap-1"><input className={`${focusClass} h-9 w-20 rounded-lg bg-[#f1f5f9] px-2 text-right font-mono font-bold text-[#0f172a]`} type="number" min="0" max="100" step="0.1" {...register("criticoInventarioPct", { valueAsNumber: true })} />%</span>
                </label>
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:col-span-5">
            <section className={`${cardClass} flex flex-col gap-4 overflow-hidden`}>
              <div className="flex items-center justify-between gap-3 pb-1">
                <div className="flex items-center gap-2">
                  <Icon className="text-[22px] text-[#0369a1]">candlestick_chart</Icon>
                  <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0f172a]">Simulador de Impacto en PVP</h2>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f0fdf4] px-2 py-1 text-xs font-semibold text-[#15803d]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#15803d]" />En Vivo</span>
              </div>

              <div className={`${insetClass} flex items-center gap-4`}>
                <div className="h-16 w-16 shrink-0 rounded-lg bg-cover bg-center shadow-sm" role="img" aria-label="Hamburguesa artesanal de referencia" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCOMS125xCh7GYmWpgDiN99Yhh0D-x8Lcr0wTsuPLW1yLjJRBsz-vhu-eGUaYOGLlK_Snqdac8e-l5o8uXkpHfw1qwsxxth8g0rW8uQ3aWNhWhvrB0eP0EhGOJIdrazT-O6KKe-BQ5mnLvAsSDhc88JHmPuLZGxz2Tg_3tnO7fH6vBGIznZm2QlJO9Zc3pdV-gXCb2Dqten7gkEdOUUBZhxSHJZyTCQszpJ1vWGY9pprNOJXVMMvx28aA')" }} />
                <div className="min-w-0 flex-1">
                  <label htmlFor="recipe-simulation" className="text-xs font-semibold uppercase tracking-wide text-[#c25e19]">Plato Testigo de Calibración</label>
                  <select id="recipe-simulation" className={`${focusClass} mt-0.5 w-full truncate bg-transparent text-base font-semibold text-[#0f172a]`} value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>
                    {recipes.length === 0 ? <option value="">Sin recetas disponibles</option> : null}
                    {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.nombre}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-[#94a3b8]">Costo Insumos Directos: <strong className="font-mono text-sm text-[#0f172a]">{localSimulation ? formatMoney(directCost) : "-"}</strong></p>
                </div>
              </div>

              {simulationLoading ? <LoadingState message="Calculando impacto…" className="py-8" /> : null}
              {!simulationLoading && !simulation ? (
                <div className="rounded-xl bg-[#f1f5f9] p-5 text-center text-sm text-[#475569]">Selecciona una receta para calibrar el impacto.</div>
              ) : null}
              {!simulationLoading && simulation && !localSimulation ? (
                <div className="rounded-xl bg-[#fffbeb] p-4 text-sm text-[#b45309]" role="status">Ajusta overhead y margen para que su suma sea menor que 100%.</div>
              ) : null}
              {!simulationLoading && localSimulation ? (
                <>
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs font-medium text-[#94a3b8]"><span>Desglose Estructural del Precio</span><strong className="text-[#0f172a]">Food Cost: {foodPct.toFixed(1)}%</strong></div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#e0e3e5]">
                      <span className="h-full bg-[#c25e19] transition-[width]" style={{ width: barWidth(directCost) }} title="Materia Prima" />
                      <span className="h-full bg-[#b45309] transition-[width]" style={{ width: barWidth(overheadCash) }} title="Overhead" />
                      <span className="h-full bg-[#15803d] transition-[width]" style={{ width: barWidth(marginCash) }} title="Margen" />
                      <span className="h-full bg-[#0369a1] transition-[width]" style={{ width: barWidth(taxCash) }} title="Impuesto" />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#94a3b8]">
                      {[["#c25e19", "Insumos"], ["#b45309", "Fijo"], ["#15803d", "Ganancia"], ["#0369a1", "Tributo"]].map(([color, label]) => <span key={label} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}
                    </div>
                  </div>

                  <div className="divide-y divide-[#e2e8f0] text-sm">
                    {[
                      ["1", "Costo directo (Insumos netos)", formatMoney(directCost), "text-[#0f172a]"],
                      ["2", `Absorción Overhead (${values.overheadPct.toFixed(1)}%)`, `+${formatMoney(overheadCash)}`, "text-[#b45309]"],
                      ["3", `Margen de utilidad neta (${values.margenObjetivoPct.toFixed(1)}%)`, `+${formatMoney(marginCash)}`, "text-[#15803d]"],
                    ].map(([step, label, amount, color]) => (
                      <div key={step} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex items-center gap-2 text-[#475569]"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-xs font-bold">{step}</span><span>{label}</span></div>
                        <strong className={`shrink-0 font-mono ${color}`}>{amount}</strong>
                      </div>
                    ))}
                    <div className="my-0.5 flex items-center justify-between rounded-lg bg-[#f1f5f9]/70 px-2 py-2.5"><span className="font-medium text-[#0f172a]">Subtotal Sugerido (Base)</span><strong className="font-mono text-[#0f172a]">{formatMoney(subtotal)}</strong></div>
                    <div className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-2 text-[#475569]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f1f5f9] text-xs font-bold">4</span><span>Impuesto al Consumo ({taxPct.toFixed(1)}%)</span></div>
                      <strong className="shrink-0 font-mono text-[#0369a1]">+{formatMoney(taxCash)}</strong>
                    </div>
                    <div className="flex items-end justify-between gap-3 pb-1 pt-3">
                      <div><p className="text-lg font-semibold text-[#0f172a]">PVP Carta Sugerido</p><p className="text-xs text-[#94a3b8]">{roundingLabels[values.redondeoPrecio]}</p></div>
                      <div className="text-right"><strong className="block text-3xl font-bold tracking-[-0.03em] text-[#c25e19]">{formatMoney(localSimulation.precioSugeridoFinal)}</strong><span className="text-[11px] text-[#94a3b8]">Exacto: {formatMoney(exactTotal)}</span></div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-xl bg-[#fffbeb] p-4">
                    <Icon className="mt-0.5 shrink-0 text-xl text-[#b45309]">sync_problem</Icon>
                    <div><p className="text-xs font-bold text-[#b45309]">Impacto Global Inmediato</p><p className="mt-0.5 text-[13px] leading-5 text-[#475569]">Al guardar, <strong className="text-[#0f172a]">{activeRecipes} recetas activas</strong> recalcularán sus precios de referencia sin alterar costos históricos de venta.</p></div>
                  </div>
                </>
              ) : null}
            </section>

            <section className={`${cardClass} flex flex-col gap-3`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-[#0f172a]">Registro de Calibraciones</h2>
                <button type="button" className={`${focusClass} text-xs font-medium text-[#c25e19] hover:underline`} onClick={() => setAuditOpen((open) => !open)}>{auditOpen ? "Ocultar historial" : "Ver historial completo"}</button>
              </div>
              {audit.length === 0 ? <p className="rounded-lg bg-[#f1f5f9] p-3 text-xs text-[#94a3b8]">Sin calibraciones registradas.</p> : (
                <div className="flex flex-col gap-2 text-xs">
                  {(auditOpen ? audit : audit.slice(0, 2)).map((entry) => (
                    <div key={entry.id} className="grid gap-1 rounded-lg bg-[#f1f5f9] p-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="flex min-w-0 items-center gap-2"><Icon className="text-base text-[#94a3b8]">account_circle</Icon><span className="truncate font-medium text-[#0f172a]">{entry.usuario.email}</span></div>
                      <span className="font-mono text-[#94a3b8] sm:text-right">{DATE_FORMATTER.format(new Date(entry.creadoEn))}</span>
                      <p className="text-[#64748b] sm:col-span-2"><strong className="text-[#475569]">{FIELD_LABELS[entry.campo] ?? entry.campo}:</strong> {displayAuditValue(entry.campo, entry.valorAnterior)} → {displayAuditValue(entry.campo, entry.valorNuevo)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </form>

      <ConfirmModal
        open={restoreOpen}
        title="Restaurar valores predeterminados"
        description="Se aplicarán overhead 12 %, margen 56.2 %, impoconsumo 8 %, food cost crítico 35 % y volatilidad 15 %. Cada cambio quedará auditado."
        confirmLabel={restoring ? "Restaurando…" : "Restaurar valores"}
        variant="danger"
        onCancel={() => { if (!restoring) setRestoreOpen(false); }}
        onConfirm={() => { if (!restoring) void restoreDefaults(); }}
      />
    </div>
  );
}
