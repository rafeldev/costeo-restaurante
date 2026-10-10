import { beforeEach, describe, expect, it, vi } from "vitest";

// Base de datos falsa en memoria: solo implementa lo que usa lib/inventory.ts.
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const store = vi.hoisted(() => ({
  insumos: [] as Row[],
  proveedores: [] as Row[],
  recetas: [] as Row[], // cada receta trae `ingredientes` con `insumo` embebido
  inventarios: [] as Row[],
  movimientos: [] as Row[],
  producciones: [] as Row[],
  compras: [] as Row[],
  seq: 0,
}));

vi.mock("@/lib/db", () => {
  const nextId = (prefix: string) => `${prefix}-${++store.seq}`;
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  const tx = {
    insumo: {
      findFirst: async ({ where }: { where: Row }) =>
        store.insumos.find((r) => matches(r, where)) ?? null,
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = store.insumos.find((r) => matches(r, where))!;
        Object.assign(row, data);
        return row;
      },
    },
    proveedor: {
      findFirst: async ({ where }: { where: Row }) =>
        store.proveedores.find((r) => matches(r, where)) ?? null,
    },
    compraInsumo: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: nextId("compra"), ...data };
        store.compras.push(row);
        return row;
      },
    },
    inventarioInsumo: {
      upsert: async ({ where, create }: { where: Row; create: Row }) => {
        let row = store.inventarios.find((r) => matches(r, where));
        if (!row) {
          row = { ...create };
          store.inventarios.push(row);
        }
        return row;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = store.inventarios.find((r) => matches(r, where))!;
        Object.assign(row, data);
        return row;
      },
    },
    movimientoInventario: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: nextId("mov"), ...data };
        store.movimientos.push(row);
        return row;
      },
    },
    receta: {
      findFirst: async ({ where }: { where: Row }) =>
        store.recetas.find((r) => matches(r, where)) ?? null,
    },
    produccion: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: nextId("prod"), ...data };
        store.producciones.push(row);
        return row;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = store.producciones.find((r) => matches(r, where))!;
        Object.assign(row, data);
        return row;
      },
      findFirst: async ({ where }: { where: Row }) => {
        const row = store.producciones.find((r) => matches(r, where));
        if (!row) return null;
        return {
          ...row,
          movimientos: store.movimientos.filter((m) => m.produccionId === row.id),
        };
      },
    },
  };

  return { db: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});

import {
  anularProduccion,
  editarProduccion,
  registrarCompraInsumo,
  registrarProduccionReceta,
} from "./inventory";

const OWNER = "owner-1";
const OTHER = "owner-2";

const stockOf = (insumoId: string) =>
  store.inventarios.find((i) => i.insumoId === insumoId)?.stockActual;

const seedInsumo = (over: Row = {}) => {
  const row = {
    id: "ins-1",
    ownerId: OWNER,
    nombre: "Carne",
    unidadBase: "GRAMO",
    costoUnidad: 10,
    mermaPct: 0,
    ...over,
  };
  store.insumos.push(row);
  return row;
};

const seedReceta = (ingredientes: Row[], over: Row = {}) => {
  const row = {
    id: "rec-1",
    ownerId: OWNER,
    nombre: "Hamburguesa",
    ingredientes,
    ...over,
  };
  store.recetas.push(row);
  return row;
};

beforeEach(() => {
  store.insumos.length = 0;
  store.proveedores.length = 0;
  store.recetas.length = 0;
  store.inventarios.length = 0;
  store.movimientos.length = 0;
  store.producciones.length = 0;
  store.compras.length = 0;
  store.seq = 0;
});

describe("registrarCompraInsumo", () => {
  it("actualiza costo, suma stock en unidad base y crea movimiento ENTRADA", async () => {
    seedInsumo(); // unidad base GRAMO

    const result = await registrarCompraInsumo({
      ownerId: OWNER,
      insumoId: "ins-1",
      cantidadCompra: 2,
      unidadCompra: "KILOGRAMO",
      precioTotal: 20000,
    });

    expect(store.insumos[0]?.costoUnidad).toBe(10); // 20000 / 2000 g
    expect(result.inventario.stockActual).toBe(2000);
    expect(store.movimientos).toHaveLength(1);
    expect(store.movimientos[0]).toMatchObject({
      tipo: "ENTRADA",
      cantidad: 2000,
      referenciaCompraId: result.compra.id,
    });
  });

  it("rechaza unidades incompatibles", async () => {
    seedInsumo();

    await expect(
      registrarCompraInsumo({
        ownerId: OWNER,
        insumoId: "ins-1",
        cantidadCompra: 1,
        unidadCompra: "LITRO",
        precioTotal: 5000,
      }),
    ).rejects.toThrow("No fue posible calcular costo unitario");
    expect(store.compras).toHaveLength(0);
  });

  it("rechaza insumo de otro usuario", async () => {
    seedInsumo({ ownerId: OTHER });

    await expect(
      registrarCompraInsumo({
        ownerId: OWNER,
        insumoId: "ins-1",
        cantidadCompra: 1,
        unidadCompra: "GRAMO",
        precioTotal: 100,
      }),
    ).rejects.toThrow("Insumo no encontrado");
  });

  it("rechaza proveedor de otro usuario", async () => {
    seedInsumo();
    store.proveedores.push({ id: "prov-1", ownerId: OTHER });

    await expect(
      registrarCompraInsumo({
        ownerId: OWNER,
        insumoId: "ins-1",
        proveedorId: "prov-1",
        cantidadCompra: 1,
        unidadCompra: "GRAMO",
        precioTotal: 100,
      }),
    ).rejects.toThrow("Proveedor no encontrado");
  });
});

describe("producciones", () => {
  const setupReceta = () => {
    const insumo = seedInsumo({ mermaPct: 10, costoUnidad: 2 });
    store.inventarios.push({ insumoId: "ins-1", stockActual: 1000, stockMinimo: 0 });
    seedReceta([{ insumoId: "ins-1", cantidad: 100, insumo }]);
  };

  it("registrar: descuenta con merma y calcula el costo total", async () => {
    setupReceta();

    const result = await registrarProduccionReceta({
      ownerId: OWNER,
      recetaId: "rec-1",
      unidades: 2,
    });

    // 100 g × 2 unidades × 1.10 de merma = 220 g; costo 220 × 2 = 440
    expect(stockOf("ins-1")).toBeCloseTo(780);
    expect(result.costoTotalProduccion).toBeCloseTo(440);
    expect(store.producciones[0]).toMatchObject({ estado: "ACTIVA", recetaNombre: "Hamburguesa" });
    expect(store.producciones[0]?.costoTotalProduccion).toBeCloseTo(440);
    expect(store.movimientos).toHaveLength(1);
    expect(store.movimientos[0]).toMatchObject({ tipo: "SALIDA", produccionId: result.produccionId });
    expect(store.movimientos[0]?.cantidad).toBeCloseTo(220);
  });

  it("registrar: rechaza receta sin ingredientes", async () => {
    seedReceta([]);

    await expect(
      registrarProduccionReceta({ ownerId: OWNER, recetaId: "rec-1", unidades: 1 }),
    ).rejects.toThrow("no tiene ingredientes");
  });

  it("registrar: rechaza receta de otro usuario", async () => {
    setupReceta();

    await expect(
      registrarProduccionReceta({ ownerId: OTHER, recetaId: "rec-1", unidades: 1 }),
    ).rejects.toThrow("Receta no encontrada");
  });

  it("registrar: rechaza ingrediente de otro usuario", async () => {
    const foreign = seedInsumo({ ownerId: OTHER });
    seedReceta([{ insumoId: "ins-1", cantidad: 1, insumo: foreign }]);

    await expect(
      registrarProduccionReceta({ ownerId: OWNER, recetaId: "rec-1", unidades: 1 }),
    ).rejects.toThrow("fuera del alcance");
  });

  it("anular: devuelve lo descontado y rechaza una segunda anulación", async () => {
    setupReceta();
    const { produccionId } = await registrarProduccionReceta({
      ownerId: OWNER,
      recetaId: "rec-1",
      unidades: 2,
    });

    await anularProduccion({ ownerId: OWNER, produccionId });

    expect(stockOf("ins-1")).toBeCloseTo(1000);
    expect(store.producciones[0]?.estado).toBe("ANULADA");
    expect(store.movimientos.at(-1)).toMatchObject({ tipo: "ENTRADA", produccionId });
    expect(store.movimientos.at(-1)?.cantidad).toBeCloseTo(220);

    await expect(anularProduccion({ ownerId: OWNER, produccionId })).rejects.toThrow(
      "ya fue anulada",
    );
  });

  it("editar: anula la original y crea una nueva con la misma fecha", async () => {
    setupReceta();
    const fecha = new Date("2026-01-15T10:00:00Z");
    const { produccionId } = await registrarProduccionReceta({
      ownerId: OWNER,
      recetaId: "rec-1",
      unidades: 2,
      fechaProduccion: fecha,
    });

    const result = await editarProduccion({
      ownerId: OWNER,
      produccionId,
      nuevasUnidades: 3,
    });

    // stock: 1000 − 220 (original) + 220 (devolución) − 330 (nueva) = 670
    expect(stockOf("ins-1")).toBeCloseTo(670);
    expect(result.produccionAnuladaId).toBe(produccionId);
    expect(result.costoTotalProduccion).toBeCloseTo(660);
    const nueva = store.producciones.find((p) => p.id === result.nuevaProduccionId);
    expect(nueva).toMatchObject({ estado: "ACTIVA", unidades: 3 });
    expect(nueva?.fechaProduccion).toEqual(fecha);
    expect(store.producciones.find((p) => p.id === produccionId)?.estado).toBe("ANULADA");
  });

  it("editar: rechaza una producción anulada", async () => {
    setupReceta();
    const { produccionId } = await registrarProduccionReceta({
      ownerId: OWNER,
      recetaId: "rec-1",
      unidades: 1,
    });
    await anularProduccion({ ownerId: OWNER, produccionId });

    await expect(
      editarProduccion({ ownerId: OWNER, produccionId, nuevasUnidades: 1 }),
    ).rejects.toThrow("anulada");
  });

  it("editar: rechaza una producción cuya receta ya no existe", async () => {
    setupReceta();
    const { produccionId } = await registrarProduccionReceta({
      ownerId: OWNER,
      recetaId: "rec-1",
      unidades: 1,
    });
    store.producciones[0]!.recetaId = null;

    await expect(
      editarProduccion({ ownerId: OWNER, produccionId, nuevasUnidades: 1 }),
    ).rejects.toThrow("receta asociada ya no existe");
  });
});
