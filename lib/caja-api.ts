/**
 * Cliente API para la caja (POS). Todas las funciones devuelven datos o lanzan
 * un error con mensaje amigable para la UI.
 */

export type VentaItem = {
  id: string;
  ventaId: string;
  recetaId: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  receta?: { id: string; nombre: string };
};

export type Venta = {
  id: string;
  ownerId: string;
  fechaHora: string;
  total: number;
  estado: string;
  mesa: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  items?: VentaItem[];
};

export type Receta = {
  id: string;
  nombre: string;
  tipoProducto: string;
  rendimientoPorciones: number;
  tiempoPreparacionMin: number | null;
  precioVentaActual: number | null;
  createdAt: string;
  updatedAt: string;
};

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.message === "string" ? data.message : "Algo salió mal. Intente de nuevo.";
    throw new Error(message);
  }
  return data as T;
}

export async function fetchVentasAbiertas(): Promise<Venta[]> {
  const res = await fetch("/api/ventas?estado=ABIERTA");
  return handleResponse<Venta[]>(res);
}

export async function createVenta(body?: { mesa?: string; notas?: string }): Promise<Venta> {
  const res = await fetch("/api/ventas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return handleResponse<Venta>(res);
}

export async function fetchVenta(id: string): Promise<Venta> {
  const res = await fetch(`/api/ventas/${id}`);
  return handleResponse<Venta>(res);
}

export async function patchVenta(
  id: string,
  body: { mesa?: string | null; notas?: string | null }
): Promise<Venta> {
  const res = await fetch(`/api/ventas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<Venta>(res);
}

export async function addVentaItem(
  ventaId: string,
  body: { recetaId: string; cantidad: number; precioUnitario?: number }
): Promise<VentaItem> {
  const res = await fetch(`/api/ventas/${ventaId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<VentaItem>(res);
}

export async function removeVentaItem(ventaId: string, itemId: string): Promise<void> {
  const res = await fetch(`/api/ventas/${ventaId}/items/${itemId}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data?.message === "string" ? data.message : "No se pudo eliminar el ítem."
    );
  }
}

export async function cerrarVenta(id: string): Promise<Venta> {
  const res = await fetch(`/api/ventas/${id}/cerrar`, { method: "POST" });
  return handleResponse<Venta>(res);
}

export async function cancelarVenta(id: string): Promise<Venta> {
  const res = await fetch(`/api/ventas/${id}/cancelar`, { method: "POST" });
  return handleResponse<Venta>(res);
}

export async function fetchRecetas(): Promise<Receta[]> {
  const res = await fetch("/api/recetas");
  return handleResponse<Receta[]>(res);
}
