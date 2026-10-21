# Ventas y Mezcla de Menú Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners register unidades vendidas per receta per month and see real economic impact (margen total, food cost ponderado) and a Miller & Kasavana menu-engineering classification (Estrella / Caballo de Batalla / Puzzle / Perro), closing the gap documented for pantalla 5 ("sin matriz BCG real, que requiere ventas y se eliminó el esquema de ventas").

**Architecture:** One new Prisma model (`VentaReceta`, manual sales entry decoupled from `Produccion`/inventory) behind a `lib/ventas-service.ts` service that reuses the existing `costRecipe`/`recetaInclude` cost engine from `lib/receta-service.ts`. Pure classification math lives in `lib/menu-engineering.ts` so it is unit-testable without a database. One route (`app/api/ventas-recetas/route.ts`, GET + PATCH) and one client module (`components/mezcla/MezclaMenuModule.tsx`) at a new `/mezcla` route, wired into `components/MainNav.tsx`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 / PostgreSQL, Zod, Vitest (`*.test.ts` unit, `*.integration.test.ts` against `DATABASE_URL_TEST`).

**Spec:** `docs/plan-migracion-stitch.md` § "15. Pantalla 8 (adición post-migración): Ventas y Mezcla de Menú"

## Global Constraints

- Every API handler calls `requireAuthUser()` first and returns JSON errors via `handleRouteError()` (`lib/api-errors.ts`); `export const runtime = "nodejs"`.
- Scope every read/write by `ownerId`, including client-supplied `recetaId`s — never trust a foreign id as valid (AGENTS.md).
- Decimals persist via Prisma `Decimal`; API responses convert through `decimalToNumber`/`toPlainNumber` (`lib/serializers.ts`). `unidadesVendidas` is a plain `Int` (a count), not a `Decimal`.
- Food cost % and margen reuse the existing `costRecipe()` formula from `lib/receta-service.ts` (net of tax) for consistency with Recetas and el Inicio — do not recompute a different gross formula even though the Stitch mockup's numbers imply one (documented deviation, spec § 15).
- UI copy is Spanish; reuse `components/ui/` primitives (`Badge`, `KpiCard`, `EducationalCallout`, `EmptyState`, `ErrorState`, `LoadingState`) instead of new one-off styles.
- `npm run db:migrate` creates the committed migration; `npm run test:integration` runs serially against `DATABASE_URL_TEST`, never dev/prod.

## Review Focus

- Receta activa sin `precioVentaActual` (sin PVP de carta): debe quedar "Sin dato" (fuera de umbrales y cuadrantes), nunca un cálculo con `null` filtrando a `NaN`.
- `unidadesVendidas` negativo o no entero enviado por el cliente: el PATCH debe rechazar con 400 y no escribir nada.
- `recetaId` que pertenece a otro owner en el PATCH: debe rechazarse antes de cualquier escritura (regla de scoping de AGENTS.md), no fallar a medias.
- Periodo sin ninguna fila de `VentaReceta`: los KPI deben quedar en `null`/`0` y la UI mostrar `EmptyState`, sin división por cero en el food cost ponderado.
- `recetaId` repetido dentro del mismo PATCH: debe rechazarse explícitamente (como ya hace `assertOwnedIngredients` con insumos repetidos), no "el último gana" silencioso.

---

## Task 1: Esquema `VentaReceta` y migración

**Files:**
- Modify: `prisma/schema.prisma` (añadir modelo `VentaReceta`, relación `ventasRecetas` en `User` y `ventas` en `Receta`)

**Interfaces:**
- Produces: modelo Prisma `VentaReceta { id, ownerId, recetaId, periodo, unidadesVendidas, createdAt, updatedAt }`, único por `[ownerId, recetaId, periodo]`, usado por las tareas 2–4.

- [ ] **Step 1: Añadir el modelo a `prisma/schema.prisma`**

```prisma
model VentaReceta {
  id               String   @id @default(cuid())
  ownerId          String
  recetaId         String
  periodo          String
  unidadesVendidas Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  owner            User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  receta           Receta   @relation(fields: [recetaId], references: [id], onDelete: Cascade)

  @@unique([ownerId, recetaId, periodo])
  @@index([ownerId, periodo])
}
```

Añadir `ventasRecetas VentaReceta[]` a `model User` y `ventas VentaReceta[]` a `model Receta`.

- [ ] **Step 2: Generar y aplicar la migración**

Run: `npm run db:migrate` (nombra la migración `venta_receta` cuando lo pida), luego `npm run db:generate`.
Expected: migración nueva en `prisma/migrations/`, `npx tsc --noEmit` sin errores por el cliente Prisma desactualizado.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add VentaReceta model for menu sales tracking"
```

---

## Task 2: Clasificación de cuadrante y food cost ponderado (puro, sin DB)

**Files:**
- Create: `lib/menu-engineering.ts`
- Test: `lib/menu-engineering.test.ts`

**Interfaces:**
- Consumes: nada (funciones puras sobre números).
- Produces:
  - `export type Cuadrante = "Estrella" | "Caballo de Batalla" | "Puzzle" | "Perro" | "Sin dato"`
  - `export function classifyCuadrante(input: { unidadesVendidas: number; margenUnitario: number | null; umbralUnidades: number; umbralMargen: number; tieneVentaRegistrada: boolean }): Cuadrante`
  - `export function calculateUmbrales(items: Array<{ unidadesVendidas: number; margenUnitario: number | null; tieneVentaRegistrada: boolean }>): { umbralUnidades: number; umbralMargen: number } | null` (null si ningún item califica — ver Step 1, caso c)
  - `export function calculateFoodCostPonderado(items: Array<{ costoPorcion: number; ventaNeta: number | null; unidadesVendidas: number; tieneVentaRegistrada: boolean }>): number | null`

Usados por `lib/ventas-service.ts` (Tarea 3).

- [ ] **Step 1: Escribir los tests que fallan**

```ts
import { describe, expect, it } from "vitest";
import { calculateFoodCostPonderado, calculateUmbrales, classifyCuadrante } from "@/lib/menu-engineering";

describe("classifyCuadrante", () => {
  it("clasifica Estrella cuando unidades y margen superan el umbral", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 840, margenUnitario: 8.15, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Estrella");
  });

  it("clasifica Caballo de Batalla con alta popularidad y bajo margen", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 1120, margenUnitario: 3.9, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Caballo de Batalla");
  });

  it("clasifica Puzzle con baja popularidad y alto margen", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 190, margenUnitario: 13.15, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Puzzle");
  });

  it("clasifica Perro con baja popularidad y bajo margen", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 45, margenUnitario: 3.0, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Perro");
  });

  it("devuelve Sin dato sin venta registrada", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 0, margenUnitario: 10.4, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: false }),
    ).toBe("Sin dato");
  });

  it("devuelve Sin dato sin PVP de carta (margenUnitario null)", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 100, margenUnitario: null, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Sin dato");
  });
});

describe("calculateUmbrales", () => {
  it("promedia solo los items con venta registrada y margen conocido", () => {
    const result = calculateUmbrales([
      { unidadesVendidas: 840, margenUnitario: 8.15, tieneVentaRegistrada: true },
      { unidadesVendidas: 40, margenUnitario: 4.41, tieneVentaRegistrada: true },
      { unidadesVendidas: 0, margenUnitario: null, tieneVentaRegistrada: false },
    ]);
    expect(result).toEqual({ umbralUnidades: 440, umbralMargen: 6.28 });
  });

  it("devuelve null cuando ningún item tiene venta registrada", () => {
    expect(
      calculateUmbrales([{ unidadesVendidas: 0, margenUnitario: null, tieneVentaRegistrada: false }]),
    ).toBeNull();
  });
});

describe("calculateFoodCostPonderado", () => {
  it("pondera por unidades vendidas", () => {
    const result = calculateFoodCostPonderado([
      { costoPorcion: 2.8, ventaNeta: 10.14, unidadesVendidas: 840, tieneVentaRegistrada: true },
      { costoPorcion: 0.9, ventaNeta: 4.44, unidadesVendidas: 1120, tieneVentaRegistrada: true },
    ]);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it("devuelve null sin recetas con PVP y venta registrada", () => {
    expect(
      calculateFoodCostPonderado([{ costoPorcion: 2.8, ventaNeta: null, unidadesVendidas: 0, tieneVentaRegistrada: false }]),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- lib/menu-engineering.test.ts`
Expected: FAIL (`Cannot find module '@/lib/menu-engineering'`)

- [ ] **Step 3: Implementar `lib/menu-engineering.ts`**

`classifyCuadrante`: si `!tieneVentaRegistrada || margenUnitario === null` → `"Sin dato"`; si no, `unidadesVendidas >= umbralUnidades` cruzado con `margenUnitario >= umbralMargen` da las cuatro combinaciones (Estrella / Caballo de Batalla / Puzzle / Perro), según la tabla de la spec § 15.
`calculateUmbrales`: filtra a los items con `tieneVentaRegistrada && margenUnitario !== null`; si el resultado está vacío devuelve `null`; si no, promedio simple (`reduce`/`length`, redondeado a 2 decimales) de `unidadesVendidas` y de `margenUnitario`.
`calculateFoodCostPonderado`: filtra a los items con `tieneVentaRegistrada && ventaNeta !== null && ventaNeta > 0`; si queda vacío devuelve `null`; si no, `Σ(costoPorcion × unidadesVendidas) / Σ(ventaNeta × unidadesVendidas) × 100`, redondeado a 2 decimales.

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- lib/menu-engineering.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/menu-engineering.ts lib/menu-engineering.test.ts
git commit -m "feat: add menu-engineering classification helpers"
```

---

## Task 3: Validación y servicio `lib/ventas-service.ts`

**Files:**
- Modify: `lib/validation.ts` (añadir `ventasRecetasPatchSchema`)
- Create: `lib/ventas-service.ts`
- Test: `lib/ventas-service.integration.test.ts`

**Interfaces:**
- Consumes: `recetaInclude`, `costRecipe` de `lib/receta-service.ts` (Tarea existente, no se modifica); `classifyCuadrante`, `calculateUmbrales`, `calculateFoodCostPonderado` de `lib/menu-engineering.ts` (Tarea 2); `db` de `lib/db`; `NotFoundError`, `ValidationError` de `lib/errors`.
- Produces:
  - `export const ventasRecetasPatchSchema` en `lib/validation.ts`: `{ periodo: string (regex AAAA-MM), items: Array<{ recetaId: string; unidadesVendidas: int >= 0 }> (1..200, sin recetaId repetido) }`.
  - `export async function getMezclaMenu(ownerId: string, periodo: string)` → `{ periodo, kpis: { unidadesVendidas: number, foodCostPonderadoPct: number | null, mayorImpacto: { recetaId: string; nombre: string; margenTotal: number } | null, sinDato: number }, items: Array<{ recetaId, codigo, nombre, categoria, unidadesVendidas, tieneVentaRegistrada, costoPorcion, pvpCarta, margenUnitario, margenTotal, foodCostPct, cuadrante }>, totales: { unidadesVendidas, margenTotal } }` — usado por la Tarea 4 (GET).
  - `export async function upsertVentasRecetas(ownerId: string, data: z.output<typeof ventasRecetasPatchSchema>)` → `void`, usado por la Tarea 4 (PATCH).

- [ ] **Step 1: Añadir el schema de validación**

En `lib/validation.ts`, junto a `abrirTomaInventarioSchema`:

```ts
export const ventaRecetaItemSchema = z.object({
  recetaId: z.string().min(1),
  unidadesVendidas: z.number().int().min(0),
});

export const ventasRecetasPatchSchema = z.object({
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El periodo debe tener formato AAAA-MM"),
  items: z.array(ventaRecetaItemSchema).min(1).max(200),
}).superRefine((value, context) => {
  const ids = new Set(value.items.map((item) => item.recetaId));
  if (ids.size !== value.items.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "No repitas una receta en el mismo envío" });
  }
});
```

- [ ] **Step 2: Escribir y pasar los tests del schema (Review Focus: cantidades inválidas y recetaId repetido)**

Crear `lib/validation.ventas.test.ts` siguiendo el estilo de `lib/validation.inventory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ventasRecetasPatchSchema } from "./validation";

const base = { periodo: "2026-10", items: [{ recetaId: "receta-1", unidadesVendidas: 10 }] };

describe("ventasRecetasPatchSchema", () => {
  it("rechaza unidadesVendidas negativas", () => {
    expect(
      ventasRecetasPatchSchema.safeParse({ periodo: "2026-10", items: [{ recetaId: "receta-1", unidadesVendidas: -1 }] }).success,
    ).toBe(false);
  });

  it("rechaza unidadesVendidas decimales", () => {
    expect(
      ventasRecetasPatchSchema.safeParse({ periodo: "2026-10", items: [{ recetaId: "receta-1", unidadesVendidas: 1.5 }] }).success,
    ).toBe(false);
  });

  it("rechaza recetaId repetido en el mismo envío", () => {
    const result = ventasRecetasPatchSchema.safeParse({
      periodo: "2026-10",
      items: [
        { recetaId: "receta-1", unidadesVendidas: 10 },
        { recetaId: "receta-1", unidadesVendidas: 20 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un periodo con formato inválido", () => {
    expect(ventasRecetasPatchSchema.safeParse({ ...base, periodo: "2026-10-01" }).success).toBe(false);
  });

  it("acepta un envío válido", () => {
    expect(ventasRecetasPatchSchema.safeParse(base).success).toBe(true);
  });
});
```

Run: `npm test -- lib/validation.ventas.test.ts` → debe pasar de inmediato (el schema ya existe desde el Step 1); si alguna aserción falla, ajustar el schema, no el test.

- [ ] **Step 3: Escribir el test de integración que falla**

```ts
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { upsertVentasRecetas, getMezclaMenu } from "@/lib/ventas-service";

describe("ventas de recetas contra PostgreSQL", () => {
  it("upserta ventas propias y rechaza recetaId de otro owner", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await db.user.create({ data: { email: `ventas-${suffix}@example.com`, passwordHash: "integration-test" } });
    const otherOwner = await db.user.create({ data: { email: `ventas-other-${suffix}@example.com`, passwordHash: "integration-test" } });
    try {
      const receta = await db.receta.create({
        data: { ownerId: owner.id, codigo: "RC-901", nombre: `Receta ${suffix}`, categoria: "PLATOS_FUERTES", rendimientoPorciones: 1, precioVentaActual: 20, activa: true, borrador: false },
      });
      const foreignReceta = await db.receta.create({
        data: { ownerId: otherOwner.id, codigo: "RC-902", nombre: `Receta ajena ${suffix}`, categoria: "PLATOS_FUERTES", rendimientoPorciones: 1, activa: true, borrador: false },
      });

      await upsertVentasRecetas(owner.id, { periodo: "2026-10", items: [{ recetaId: receta.id, unidadesVendidas: 50 }] });
      await expect(
        db.ventaReceta.findUniqueOrThrow({ where: { ownerId_recetaId_periodo: { ownerId: owner.id, recetaId: receta.id, periodo: "2026-10" } } }),
      ).resolves.toMatchObject({ unidadesVendidas: 50 });

      await upsertVentasRecetas(owner.id, { periodo: "2026-10", items: [{ recetaId: receta.id, unidadesVendidas: 75 }] });
      await expect(
        db.ventaReceta.findUniqueOrThrow({ where: { ownerId_recetaId_periodo: { ownerId: owner.id, recetaId: receta.id, periodo: "2026-10" } } }),
      ).resolves.toMatchObject({ unidadesVendidas: 75 });

      await expect(
        upsertVentasRecetas(owner.id, { periodo: "2026-10", items: [{ recetaId: foreignReceta.id, unidadesVendidas: 10 }] }),
      ).rejects.toThrow();
      await expect(db.ventaReceta.findFirst({ where: { recetaId: foreignReceta.id } })).resolves.toBeNull();
    } finally {
      await db.user.delete({ where: { id: owner.id } });
      await db.user.delete({ where: { id: otherOwner.id } });
    }
  });

  it("getMezclaMenu excluye del cuadrante a las recetas sin venta registrada", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await db.user.create({ data: { email: `mezcla-${suffix}@example.com`, passwordHash: "integration-test" } });
    try {
      await db.configuracionCosteo.create({ data: { ownerId: owner.id } });
      const conVenta = await db.receta.create({
        data: { ownerId: owner.id, codigo: "RC-903", nombre: `Con venta ${suffix}`, categoria: "PLATOS_FUERTES", rendimientoPorciones: 1, precioVentaActual: 20, activa: true, borrador: false },
      });
      await db.receta.create({
        data: { ownerId: owner.id, codigo: "RC-904", nombre: `Sin venta ${suffix}`, categoria: "PLATOS_FUERTES", rendimientoPorciones: 1, precioVentaActual: 20, activa: true, borrador: false },
      });
      await upsertVentasRecetas(owner.id, { periodo: "2026-10", items: [{ recetaId: conVenta.id, unidadesVendidas: 30 }] });

      const resultado = await getMezclaMenu(owner.id, "2026-10");
      expect(resultado.kpis.sinDato).toBe(1);
      const sinVenta = resultado.items.find((item) => item.recetaId !== conVenta.id)!;
      expect(sinVenta.cuadrante).toBe("Sin dato");
    } finally {
      await db.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await db.$disconnect();
});
```

- [ ] **Step 4: Ejecutar y verificar que falla**

Run: `npm run test:integration -- lib/ventas-service.integration.test.ts`
Expected: FAIL (`Cannot find module '@/lib/ventas-service'`)

- [ ] **Step 5: Implementar `lib/ventas-service.ts`**

`upsertVentasRecetas(ownerId, { periodo, items })`: dentro de `db.$transaction`, primero `tx.receta.count({ where: { ownerId, id: { in: items.map(i => i.recetaId) } } })` y comparar contra `items.length`; si no calzan, `throw new NotFoundError("Una o más recetas no existen o no pertenecen al usuario.")` sin escribir nada. Si calzan, un `tx.ventaReceta.upsert(...)` por item (`where: { ownerId_recetaId_periodo: { ownerId, recetaId, periodo } }`, `create`/`update` con `unidadesVendidas`).

`getMezclaMenu(ownerId, periodo)`: trae `db.receta.findMany({ where: { ownerId, activa: true, borrador: false }, include: recetaInclude })`, la config (`db.configuracionCosteo.findFirst` como en `lib/dashboard.ts`) y `db.ventaReceta.findMany({ where: { ownerId, periodo } })` indexado por `recetaId`. Para cada receta: `costRecipe(receta, config)` da `costoPorcion`/`pvpCarta`/`foodCostPct`; `margenUnitario = pvpCarta !== null ? pvpCarta - costoPorcion : null`; `tieneVentaRegistrada = ventasPorReceta.has(receta.id)`; `unidadesVendidas = ventasPorReceta.get(receta.id)?.unidadesVendidas ?? 0`; `margenTotal = margenUnitario !== null ? margenUnitario * unidadesVendidas : null`. Calcula `ventaNeta` en el propio servicio (no se modifica la firma de `costRecipe`): `pvpCarta && pvpCarta > 0 ? pvpCarta / (1 + decimalToNumber(config.impuestoPct) / 100) : null`. Calcula `umbrales` con `calculateUmbrales` sobre todas las recetas (si devuelve `null`, usar `0` para ambos umbrales al llamar `classifyCuadrante` fila por fila — con `umbrales === null` ninguna fila tiene `tieneVentaRegistrada && margenUnitario !== null` a la vez, así que `classifyCuadrante` devuelve `"Sin dato"` para todas sin importar el valor de los umbrales). Arma `kpis` (`unidadesVendidas` = suma de todas las filas; `foodCostPonderadoPct` con `calculateFoodCostPonderado` pasando el `ventaNeta` recién calculado; `mayorImpacto` = la receta con `margenTotal` más alto entre las que lo tienen, o `null` si ninguna; `sinDato` = conteo de `cuadrante === "Sin dato"`) y `totales` (sumas simples de `unidadesVendidas` y `margenTotal`). Devuelve también `codigo`, `nombre`, `categoria` de cada receta para la tabla.

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `npm run test:integration -- lib/ventas-service.integration.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/validation.ts lib/validation.ventas.test.ts lib/ventas-service.ts lib/ventas-service.integration.test.ts
git commit -m "feat: add ventas-service for menu mix aggregation"
```

---

## Task 4: Endpoint `app/api/ventas-recetas/route.ts`

**Files:**
- Create: `app/api/ventas-recetas/route.ts`
- Modify: `lib/api-types.ts` (añadir `MezclaMenuDTO`)

**Interfaces:**
- Consumes: `getMezclaMenu`, `upsertVentasRecetas` de `lib/ventas-service.ts` (Tarea 3); `ventasRecetasPatchSchema` de `lib/validation.ts`; `requireAuthUser` de `lib/auth`; `handleRouteError` de `lib/api-errors`.
- Produces: `GET /api/ventas-recetas?periodo=AAAA-MM` → `MezclaMenuDTO` (el tipo de retorno de `getMezclaMenu`, serializado); `PATCH /api/ventas-recetas` → `{ ok: true }`. Usado por la Tarea 5.

- [ ] **Step 1: Añadir `MezclaMenuDTO` a `lib/api-types.ts`**

Tipar explícitamente el retorno de `getMezclaMenu` (mismos campos que el Step 4 de la Tarea 3: `periodo`, `kpis`, `items[]`, `totales`).

- [ ] **Step 2: Implementar la ruta**

```ts
import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { getMezclaMenu, upsertVentasRecetas } from "@/lib/ventas-service";
import { ventasRecetasPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const url = new URL(request.url);
    const periodo = url.searchParams.get("periodo");
    if (!periodo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      return NextResponse.json({ message: "El periodo debe tener formato AAAA-MM." }, { status: 400 });
    }
    return NextResponse.json(await getMezclaMenu(user.id, periodo));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = ventasRecetasPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Datos inválidos.", issues: parsed.error.flatten() }, { status: 400 });
    }
    await upsertVentasRecetas(user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
```

- [ ] **Step 3: Verificar el guard de autenticación**

Run: `npm test -- lib/api-auth-guard.test.ts`
Expected: PASS (la nueva ruta se descubre sola; falla si falta `requireAuthUser` en algún handler)

- [ ] **Step 4: Typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add app/api/ventas-recetas/route.ts lib/api-types.ts
git commit -m "feat: add /api/ventas-recetas GET and PATCH"
```

---

## Task 5: Nav, ruta `/mezcla` y `MezclaMenuModule`

**Files:**
- Modify: `components/MainNav.tsx` (añadir item "Mezcla" entre Recetas y Producciones)
- Create: `app/mezcla/page.tsx`
- Create: `components/mezcla/MezclaMenuModule.tsx`

**Interfaces:**
- Consumes: `GET /api/ventas-recetas?periodo=`, `PATCH /api/ventas-recetas` (Tarea 4); `MezclaMenuDTO` de `lib/api-types.ts`; `KpiCard`, `Badge`, `EducationalCallout`, `EmptyState`, `ErrorState`, `LoadingState` de `components/ui/`; `categoriaRecetaLabels` de `lib/domain`; `formatMoney`, `formatPercent` de `lib/format`.
- Produces: página visitable en `/mezcla`; ningún otro archivo depende de esta tarea.

- [ ] **Step 1: Añadir el item de navegación**

En `components/MainNav.tsx`, insertar `{ href: "/mezcla", label: "Mezcla" }` en `navItems` entre `/recetas` y `/producciones`.

- [ ] **Step 2: Crear la página**

`app/mezcla/page.tsx` sigue el patrón de `app/producciones/page.tsx` (usa `PageContainer` con `title="Ventas y Mezcla de Menú"` y una descripción corta) y renderiza `<MezclaMenuModule />`.

- [ ] **Step 3: Implementar `MezclaMenuModule.tsx`**

Client component (`"use client"`). Estado: `periodo` (string `AAAA-MM`, por defecto el mes actual), `data: MezclaMenuDTO | null`, `status: "loading" | "error" | "ready"`, `filtroCategoria`, `orden`, y un estado local `ediciones: Record<string, number>` para las unidades editadas antes de guardar (sin auto-guardado; el botón "Guardar Unidades" dispara el `PATCH` con solo las filas modificadas).

Fetch en un `useEffect` sobre `periodo` (patrón de `fetch` nativo como en `RecetasModule.tsx`), con `LoadingState`/`ErrorState`/`EmptyState` (si `data.items.length === 0`, o si no hay ninguna receta activa). Al éxito del `PATCH`, refresca con un nuevo GET y muestra un toast de `sonner` (patrón ya usado en `RecetasModule.tsx`).

Render: selector de periodo (botones ← mes →), fila de 4 `KpiCard` (Unidades Vendidas, Food Cost Ponderado, Mayor Impacto Económico, Sin Dato de Ventas), un `EducationalCallout` fijo explicando popularidad × rentabilidad, chips de filtro por `categoriaRecetaLabels` + select de orden (orden en cliente sobre `data.items`, sin nueva llamada al servidor), tabla con una fila por receta (nombre + `codigo`, categoría, input numérico de unidades con botones -/+, costo por porción, PVP, margen unitario, margen total, food cost %, `Badge` de cuadrante — mapear `Cuadrante` a `tone`: Estrella→success, Caballo de Batalla→warning, Puzzle→info, Perro→danger, Sin dato→neutral), fila de totales, y cuatro tarjetas de cuadrante (agrupar `data.items` por `cuadrante`, listando nombre + unidades + margen unitario). Botones "Descargar Reporte" e "Importar ventas (CSV)" quedan deshabilitados con `title="Próximamente"`.

- [ ] **Step 4: Levantar la app y revisar visualmente**

Run: `npm run dev`, abrir `/mezcla` en el navegador integrado a 1280 px y 375 px.
Expected: sin scroll horizontal, controles ≥ 44 px, estado vacío si no hay ventas registradas este mes, guardar unidades refresca los KPI y el cuadrante sin recargar la página.

- [ ] **Step 5: Lint y typecheck finales**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add components/MainNav.tsx app/mezcla components/mezcla
git commit -m "feat: add Ventas y Mezcla de Menú screen"
```
