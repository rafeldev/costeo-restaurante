import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const store = vi.hoisted(() => ({
  tomas: [] as Row[],
  conteos: [] as Row[],
  insumos: [] as Row[],
  inventarios: [] as Row[],
  movimientos: [] as Row[],
  lockQueries: [] as string[],
  failMovement: false,
  seq: 0,
}));

vi.mock("@/lib/db", () => {
  const nextId = (prefix: string) => `${prefix}-${++store.seq}`;
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && "in" in value) return value.in.includes(row[key]);
      return row[key] === value;
    });
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      store.lockQueries.push(strings.join("?"));
      return [];
    },
    configuracionCosteo: {
      findUnique: async () => ({
        toleranciaInventarioPct: 2,
        criticoInventarioPct: 5,
        overheadPct: 12,
        margenObjetivoPct: 56.2,
        impuestoPct: 8,
        redondeoPrecio: 100,
        foodCostCriticoPct: 35,
      }),
    },
    insumo: {
      findMany: async ({ where }: { where: Row }) => store.insumos.filter((row) => matches(row, where)),
    },
    tomaInventario: {
      findFirst: async ({ where, include }: { where: Row; include?: Row }) => {
        const row = store.tomas.find((item) => matches(item, where));
        if (!row) return null;
        return include?.conteos
          ? { ...row, conteos: store.conteos.filter((conteo) => conteo.tomaId === row.id) }
          : row;
      },
      create: async ({ data }: { data: Row }) => {
        const row: Row = { id: nextId("toma"), estado: "EN_CURSO", abiertaEn: new Date(), ...data };
        delete row.conteos;
        store.tomas.push(row);
        for (const conteo of data.conteos.create) {
          store.conteos.push({ id: nextId("conteo"), tomaId: row.id, stockFisico: null, motivo: null, ...conteo });
        }
        return row;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = store.tomas.find((item) => matches(item, where))!;
        Object.assign(row, data);
        return row;
      },
    },
    conteoInsumo: {
      count: async ({ where }: { where: Row }) => store.conteos.filter((row) => matches(row, where)).length,
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = store.conteos.find((item) => matches(item, where))!;
        Object.assign(row, data);
        return row;
      },
    },
    inventarioInsumo: {
      upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
        let row = store.inventarios.find((item) => matches(item, where));
        if (!row) {
          row = { ...create };
          store.inventarios.push(row);
        } else {
          row.stockActual += update.stockActual.increment;
        }
        return row;
      },
    },
    movimientoInventario: {
      create: async ({ data }: { data: Row }) => {
        if (store.failMovement) throw new Error("fallo simulado");
        const row = { id: nextId("mov"), ...data };
        store.movimientos.push(row);
        return row;
      },
    },
  };
  return {
    db: {
      $transaction: async (callback: (client: typeof tx) => unknown) => {
        const snapshot = structuredClone(store);
        try {
          return await callback(tx);
        } catch (error) {
          Object.assign(store, snapshot);
          throw error;
        }
      },
    },
  };
});

import { abrirTomaInventario, cerrarTomaInventario } from "./tomas-inventario";

const OWNER = "owner-1";

beforeEach(() => {
  store.tomas.length = 0;
  store.conteos.length = 0;
  store.insumos.length = 0;
  store.inventarios.length = 0;
  store.movimientos.length = 0;
  store.lockQueries.length = 0;
  store.failMovement = false;
  store.seq = 0;
});

function seedOpenCount(overrides: Row = {}) {
  store.tomas.push({ id: "toma-1", ownerId: OWNER, periodo: "2026-10", estado: "EN_CURSO" });
  store.conteos.push({
    id: "conteo-1",
    tomaId: "toma-1",
    insumoId: "ins-1",
    stockTeorico: 10,
    costoUnitario: 4,
    stockFisico: 8,
    motivo: "MERMA_EXTRA",
    ...overrides,
  });
  store.inventarios.push({ insumoId: "ins-1", stockActual: 12 });
}

describe("tomas de inventario transaccionales", () => {
  it("congela stock y costo al abrir y rechaza otra toma en curso", async () => {
    store.insumos.push({
      id: "ins-1",
      ownerId: OWNER,
      activo: true,
      nombre: "Carne",
      costoUnidad: 4,
      inventario: { stockActual: 10 },
    });
    const toma = await abrirTomaInventario(OWNER, { periodo: "2026-10" });
    expect(store.lockQueries).toContain('SELECT "id" FROM "User" WHERE "id" = ? FOR UPDATE');
    expect(store.conteos[0]).toMatchObject({
      tomaId: toma.id,
      insumoId: "ins-1",
      stockTeorico: 10,
      costoUnitario: 4,
    });
    store.insumos[0]!.costoUnidad = 9;
    store.insumos[0]!.inventario.stockActual = 30;
    expect(store.conteos[0]).toMatchObject({ stockTeorico: 10, costoUnitario: 4 });
    await expect(abrirTomaInventario(OWNER, { periodo: "2026-11" })).rejects.toThrow(
      "Ya existe una toma",
    );
  });

  it("aplica AJUSTE con signo, actualiza stock y no duplica un segundo cierre", async () => {
    seedOpenCount();
    const first = await cerrarTomaInventario(OWNER, "toma-1", "chef@example.com");
    expect(store.lockQueries).toContain('SELECT "id" FROM "User" WHERE "id" = ? FOR UPDATE');
    const second = await cerrarTomaInventario(OWNER, "toma-1", "chef@example.com");
    expect(first.yaCerrada).toBe(false);
    expect(second.yaCerrada).toBe(true);
    expect(store.inventarios[0]!.stockActual).toBe(10);
    expect(store.movimientos).toHaveLength(1);
    expect(store.movimientos[0]).toMatchObject({ tipo: "AJUSTE", cantidad: -2 });
  });

  it("rechaza pendientes salvo cierre forzado y exige motivo en una varianza crítica", async () => {
    seedOpenCount({ stockFisico: null });
    await expect(cerrarTomaInventario(OWNER, "toma-1", "chef@example.com")).rejects.toThrow(
      "conteos pendientes",
    );
    await expect(cerrarTomaInventario(OWNER, "toma-1", "chef@example.com", true)).resolves.toMatchObject({
      estado: "CERRADA",
    });

    store.tomas[0]!.estado = "EN_CURSO";
    store.conteos[0]!.stockFisico = 8;
    store.conteos[0]!.motivo = null;
    await expect(cerrarTomaInventario(OWNER, "toma-1", "chef@example.com")).rejects.toThrow(
      "debe tener un motivo",
    );
  });

  it("revierte estado, stock y movimientos si falla el cierre", async () => {
    seedOpenCount();
    store.failMovement = true;
    await expect(cerrarTomaInventario(OWNER, "toma-1", "chef@example.com")).rejects.toThrow(
      "fallo simulado",
    );
    expect(store.tomas[0]!.estado).toBe("EN_CURSO");
    expect(store.inventarios[0]!.stockActual).toBe(12);
    expect(store.movimientos).toHaveLength(0);
  });

  it("no permite cerrar una toma de otro owner", async () => {
    seedOpenCount();
    await expect(cerrarTomaInventario("owner-2", "toma-1", "otro@example.com")).rejects.toThrow(
      "Toma de inventario no encontrada",
    );
    expect(store.tomas[0]!.estado).toBe("EN_CURSO");
  });
});
