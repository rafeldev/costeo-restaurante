"use client";

import { useCallback, useEffect, useState } from "react";
import type { Receta, Venta, VentaItem } from "@/lib/caja-api";
import {
  addVentaItem as apiAddItem,
  cancelarVenta,
  cerrarVenta,
  createVenta,
  fetchRecetas,
  fetchVentasAbiertas,
  patchVenta as apiPatchVenta,
  removeVentaItem as apiRemoveItem,
} from "@/lib/caja-api";

export function useCaja() {
  const [venta, setVenta] = useState<Venta | null>(null);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refetchVenta = useCallback(async () => {
    setError(null);
    try {
      const [open] = await fetchVentasAbiertas();
      setVenta(open ?? null);
    } catch (e) {
      setVenta(null);
      setError(e instanceof Error ? e.message : "Error al cargar la venta");
    }
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ventasRes, recetasRes] = await Promise.all([
        fetchVentasAbiertas(),
        fetchRecetas(),
      ]);
      setVenta(ventasRes[0] ?? null);
      setRecetas(recetasRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setVenta(null);
      setRecetas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const createNewVenta = useCallback(async () => {
    if (!venta) {
      setActionLoading("create");
      setError(null);
      try {
        const created = await createVenta();
        setVenta(created);
        setSuccessMessage("Ticket creado");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear el ticket");
      } finally {
        setActionLoading(null);
      }
    }
  }, [venta]);

  const addItem = useCallback(
    async (recetaId: string, cantidad: number, precioUnitario?: number) => {
      if (!venta) return;
      setActionLoading(`add-${recetaId}`);
      setError(null);
      try {
        const item = await apiAddItem(venta.id, {
          recetaId,
          cantidad,
          precioUnitario,
        });
        setVenta((prev) =>
          prev
            ? {
                ...prev,
                items: [...(prev.items ?? []), item],
                total: (prev.items ?? []).reduce((s, i) => s + i.subtotal, 0) + item.subtotal,
              }
            : null
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo agregar el ítem");
      } finally {
        setActionLoading(null);
      }
    },
    [venta]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!venta) return;
      setActionLoading(`remove-${itemId}`);
      setError(null);
      try {
        await apiRemoveItem(venta.id, itemId);
        setVenta((prev) => {
          if (!prev) return null;
          const items = (prev.items ?? []).filter((i) => i.id !== itemId);
          const total = items.reduce((s, i) => s + i.subtotal, 0);
          return { ...prev, items, total };
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo quitar el ítem");
      } finally {
        setActionLoading(null);
      }
    },
    [venta]
  );

  const patchVenta = useCallback(
    async (data: { mesa?: string | null; notas?: string | null }) => {
      if (!venta) return;
      setActionLoading("patch");
      setError(null);
      try {
        const updated = await apiPatchVenta(venta.id, data);
        setVenta(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar");
      } finally {
        setActionLoading(null);
      }
    },
    [venta]
  );

  const cerrar = useCallback(async () => {
    if (!venta) return;
    setActionLoading("cerrar");
    setError(null);
    try {
      await cerrarVenta(venta.id);
      setVenta(null);
      setSuccessMessage("Venta cobrada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cobrar");
    } finally {
      setActionLoading(null);
    }
  }, [venta]);

  const cancelar = useCallback(async () => {
    if (!venta) return;
    setActionLoading("cancelar");
    setError(null);
    try {
      await cancelarVenta(venta.id);
      setVenta(null);
      setSuccessMessage("Ticket cancelado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar");
    } finally {
      setActionLoading(null);
    }
  }, [venta]);

  const clearSuccess = useCallback(() => setSuccessMessage(null), []);

  return {
    venta,
    recetas,
    loading,
    error,
    actionLoading,
    successMessage,
    refetchVenta,
    createNewVenta,
    addItem,
    removeItem,
    patchVenta,
    cerrar,
    cancelar,
    clearSuccess,
  };
}
