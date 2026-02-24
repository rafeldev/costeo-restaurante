import { decimalToNumber } from "@/lib/serializers";

type DecimalLike = { toNumber: () => number };

export function serializeVentaItem(item: {
  id: string;
  ventaId: string;
  recetaId: string;
  cantidad: DecimalLike;
  precioUnitario: DecimalLike;
  subtotal: DecimalLike;
  receta?: { id: string; nombre: string };
}) {
  return {
    ...item,
    cantidad: decimalToNumber(item.cantidad),
    precioUnitario: decimalToNumber(item.precioUnitario),
    subtotal: decimalToNumber(item.subtotal),
  };
}

export function serializeVenta(venta: {
  id: string;
  ownerId: string;
  fechaHora: Date;
  total: DecimalLike;
  estado: string;
  mesa: string | null;
  notas: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: Array<{
    id: string;
    ventaId: string;
    recetaId: string;
    cantidad: DecimalLike;
    precioUnitario: DecimalLike;
    subtotal: DecimalLike;
    receta?: { id: string; nombre: string };
  }>;
}) {
  return {
    ...venta,
    total: decimalToNumber(venta.total),
    items: venta.items?.map(serializeVentaItem),
  };
}
