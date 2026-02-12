"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { CompraInsumoDTO, InsumoDTO, ProveedorDTO } from "@/lib/api-types";
import { Field } from "@/components/ui/Field";
import { unidadBaseLabels, unidadBaseValues } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { compraInsumoSchema } from "@/lib/validation";

type FormValues = z.input<typeof compraInsumoSchema>;

const defaultValues: FormValues = {
  insumoId: "",
  proveedorId: "",
  fechaCompra: new Date().toISOString().slice(0, 16),
  cantidadCompra: 1,
  unidadCompra: "KILOGRAMO",
  precioTotal: 0,
};

export function ComprasInsumosModule() {
  const [insumos, setInsumos] = useState<InsumoDTO[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorDTO[]>([]);
  const [compras, setCompras] = useState<CompraInsumoDTO[]>([]);
  const [filtroInsumo, setFiltroInsumo] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [nuevoProveedor, setNuevoProveedor] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(compraInsumoSchema),
    defaultValues,
  });

  async function fetchData() {
    const [insumosRes, proveedoresRes, comprasRes] = await Promise.all([
      fetch("/api/insumos"),
      fetch("/api/proveedores"),
      fetch("/api/compras-insumos"),
    ]);
    if (!insumosRes.ok || !proveedoresRes.ok || !comprasRes.ok) {
      throw new Error("No se pudieron cargar los datos de compras");
    }
    const [insumosData, proveedoresData, comprasData]: [
      InsumoDTO[],
      ProveedorDTO[],
      CompraInsumoDTO[],
    ] = await Promise.all([insumosRes.json(), proveedoresRes.json(), comprasRes.json()]);
    return { insumosData, proveedoresData, comprasData };
  }

  async function loadData() {
    const { insumosData, proveedoresData, comprasData } = await fetchData();
    setInsumos(insumosData);
    setProveedores(proveedoresData);
    setCompras(comprasData);
  }

  useEffect(() => {
    let cancelled = false;
    void fetchData()
      .then(({ insumosData, proveedoresData, comprasData }) => {
        if (cancelled) return;
        setInsumos(insumosData);
        setProveedores(proveedoresData);
        setCompras(comprasData);
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

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/compras-insumos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        proveedorId: values.proveedorId || null,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo registrar la compra");
    }
    reset(defaultValues);
    await loadData();
  }

  async function crearProveedor() {
    const nombre = nuevoProveedor.trim();
    if (!nombre) return;
    const response = await fetch("/api/proveedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? "No se pudo crear proveedor");
    }
    setNuevoProveedor("");
    await loadData();
  }

  const comprasFiltradas = useMemo(() => {
    return compras.filter((compra) => {
      const byInsumo = !filtroInsumo || compra.insumoId === filtroInsumo;
      const byProveedor = !filtroProveedor || compra.proveedorId === filtroProveedor;
      return byInsumo && byProveedor;
    });
  }, [compras, filtroInsumo, filtroProveedor]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr] xl:gap-6">
      <section className="surface-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Registrar compra</h2>
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
          <Field label="Proveedor (opcional)" error={errors.proveedorId?.message}>
            <select className="input" {...register("proveedorId")}>
              <option value="">Sin proveedor</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </select>
          </Field>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-700">Crear proveedor rápido</p>
            <div className="flex gap-2">
              <input
                className="input h-10"
                placeholder="Nombre proveedor"
                value={nuevoProveedor}
                onChange={(event) => setNuevoProveedor(event.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  void crearProveedor().catch((error) => {
                    alert(error instanceof Error ? error.message : "Error inesperado");
                  })
                }
              >
                Crear
              </button>
            </div>
          </div>
          <Field label="Fecha de compra" error={errors.fechaCompra?.message}>
            <input className="input" type="datetime-local" {...register("fechaCompra")} />
          </Field>
          <Field label="Cantidad comprada" error={errors.cantidadCompra?.message}>
            <input
              className="input"
              type="number"
              min="0"
              step="0.0001"
              {...register("cantidadCompra", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Unidad de compra" error={errors.unidadCompra?.message}>
            <select className="input" {...register("unidadCompra")}>
              {unidadBaseValues.map((value) => (
                <option key={value} value={value}>
                  {unidadBaseLabels[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Precio total pagado" error={errors.precioTotal?.message}>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              {...register("precioTotal", { valueAsNumber: true })}
            />
          </Field>
          <button className="btn-primary disabled:opacity-50" disabled={isSubmitting} type="submit">
            Guardar compra
          </button>
        </form>
      </section>

      <section className="surface-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Filtrar por insumo</label>
            <select className="input" value={filtroInsumo} onChange={(event) => setFiltroInsumo(event.target.value)}>
              <option value="">Todos</option>
              {insumos.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Filtrar por proveedor</label>
            <select className="input" value={filtroProveedor} onChange={(event) => setFiltroProveedor(event.target.value)}>
              <option value="">Todos</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Historial de compras</h2>
        <p className="mt-1 text-sm text-slate-600">{comprasFiltradas.length} compras registradas</p>
        <div className="mt-3 space-y-2">
          {comprasFiltradas.map((compra) => (
            <article key={compra.id} className="rounded-lg border border-slate-200 p-3">
              <p className="font-medium text-slate-800">
                {compra.insumo?.nombre} · {new Date(compra.fechaCompra).toLocaleString("es-CO")}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Proveedor: {compra.proveedor?.nombre ?? "Sin proveedor"} · Cantidad:{" "}
                {compra.cantidadCompra.toFixed(2)} {unidadBaseLabels[compra.unidadCompra]}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Precio total: {formatMoney(compra.precioTotal)} · Costo unitario calculado:{" "}
                {formatMoney(compra.costoUnitarioCalculado)}
              </p>
            </article>
          ))}
          {comprasFiltradas.length === 0 ? (
            <p className="text-sm text-slate-500">Sin compras para los filtros seleccionados.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
