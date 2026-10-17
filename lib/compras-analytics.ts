import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { toPlainNumber } from "@/lib/serializers";

export const UMBRAL_VOLATILIDAD_PCT = 15;

export async function obtenerPoliticaVolatilidad(ownerId: string) {
  const config = await db.configuracionCosteo.findUnique({
    where: { ownerId },
    select: { alertaVolatilidadActiva: true, umbralVolatilidadPct: true },
  });
  return {
    activa: config?.alertaVolatilidadActiva ?? true,
    umbralPct: config ? toPlainNumber(config.umbralVolatilidadPct) : UMBRAL_VOLATILIDAD_PCT,
  };
}

function monthRange(periodo: string) {
  if (!/^\d{4}-\d{2}$/.test(periodo)) throw new ValidationError("El mes debe tener formato AAAA-MM");
  const [year, month] = periodo.split("-").map(Number);
  if (!year || !month || month > 12) throw new ValidationError("El mes no es válido");
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const previousStart = new Date(Date.UTC(year, month - 2, 1));
  return { start, end, previousStart };
}

export async function obtenerVariacionesPrecio(
  ownerId: string,
  horas = 72,
  politica?: { activa: boolean; umbralPct: number },
) {
  const regla = politica ?? await obtenerPoliticaVolatilidad(ownerId);
  const safeHours = Number.isFinite(horas) ? Math.min(Math.max(Math.floor(horas), 1), 720) : 72;
  const desde = new Date(Date.now() - safeHours * 60 * 60 * 1000);
  const compras = await db.compraInsumo.findMany({
    where: { insumo: { ownerId } },
    include: {
      insumo: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          mermaPct: true,
          recetaInsumos: { select: { cantidad: true, recetaId: true } },
        },
      },
    },
    orderBy: [{ insumoId: "asc" }, { fechaCompra: "desc" }, { createdAt: "desc" }],
  });

  const grouped = new Map<string, typeof compras>();
  for (const compra of compras) {
    const group = grouped.get(compra.insumoId) ?? [];
    if (group.length < 2) group.push(compra);
    grouped.set(compra.insumoId, group);
  }

  return [...grouped.values()]
    .filter((group) => group.length === 2 && group[0]!.fechaCompra >= desde)
    .map(([actual, anterior]) => {
      const precioActual = toPlainNumber(actual!.costoUnitarioCalculado);
      const precioAnterior = toPlainNumber(anterior!.costoUnitarioCalculado);
      const variacionPct = precioAnterior === 0 ? 0 : ((precioActual - precioAnterior) / precioAnterior) * 100;
      const rendimiento = 1 - toPlainNumber(actual!.insumo.mermaPct) / 100;
      const costoRecetasAntes = actual!.insumo.recetaInsumos.reduce(
        (sum, item) => sum + (toPlainNumber(item.cantidad) / rendimiento) * precioAnterior,
        0,
      );
      const costoRecetasDespues = actual!.insumo.recetaInsumos.reduce(
        (sum, item) => sum + (toPlainNumber(item.cantidad) / rendimiento) * precioActual,
        0,
      );
      return {
        insumoId: actual!.insumo.id,
        codigo: actual!.insumo.codigo,
        nombre: actual!.insumo.nombre,
        precioAnterior,
        precioActual,
        variacionPct: Number(variacionPct.toFixed(2)),
        recetasAfectadas: new Set(actual!.insumo.recetaInsumos.map((item) => item.recetaId)).size,
        costoRecetasAntes: Number(costoRecetasAntes.toFixed(4)),
        costoRecetasDespues: Number(costoRecetasDespues.toFixed(4)),
        fecha: actual!.fechaCompra,
        alerta: regla.activa && Math.abs(variacionPct) >= regla.umbralPct,
      };
    })
    .sort((a, b) => Math.abs(b.variacionPct) - Math.abs(a.variacionPct));
}

export async function obtenerResumenCompras(ownerId: string, periodo: string) {
  const { start, end, previousStart } = monthRange(periodo);
  const politica = await obtenerPoliticaVolatilidad(ownerId);
  const [actuales, anteriores, variaciones] = await Promise.all([
    db.facturaCompra.findMany({
      where: { ownerId, estado: "APLICADA", fechaEmision: { gte: start, lt: end } },
      select: { total: true, proveedorId: true },
    }),
    db.facturaCompra.findMany({
      where: { ownerId, estado: "APLICADA", fechaEmision: { gte: previousStart, lt: start } },
      select: { total: true },
    }),
    obtenerVariacionesPrecio(ownerId, 72, politica),
  ]);
  const gasto = actuales.reduce((sum, factura) => sum + toPlainNumber(factura.total), 0);
  const gastoAnterior = anteriores.reduce((sum, factura) => sum + toPlainNumber(factura.total), 0);
  return {
    gasto: Number(gasto.toFixed(4)),
    variacionVsMesAnterior:
      gastoAnterior === 0 ? null : Number((((gasto - gastoAnterior) / gastoAnterior) * 100).toFixed(2)),
    facturas: actuales.length,
    proveedores: new Set(actuales.map((factura) => factura.proveedorId)).size,
    alertasVariacion: variaciones.filter((item) => item.alerta).length,
  };
}
