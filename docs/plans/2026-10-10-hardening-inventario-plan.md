# Plan: Endurecer inventario, producciones y manejo de errores

**Fecha:** 2026-10-10
**Origen:** análisis del repo (puntos 1–10). Este plan cubre los puntos que afectan la integridad de datos y la mantenibilidad.

---

## Objetivo

Que las operaciones de inventario sean **correctas bajo concurrencia**, que el sistema **avise cuando falta stock**, y que el código de producciones y los errores de API sean **mantenibles y testeables**. Sin cambiar el esquema de la UI ni las rutas públicas.

## Fuera de alcance

- Costeo histórico (promedio ponderado / FIFO), punto 4. Requiere decisión de producto; queda como pregunta abierta.
- Implementar el módulo de Ventas (punto 10). Solo se decide si se completa o se elimina (ver Fase 6).

---

## Orden y dependencias

| Fase | Punto | Riesgo | Depende de |
|------|-------|--------|------------|
| 1. Tests de caracterización | 9 | Bajo | — |
| 2. Errores tipados | 5 | Bajo | 1 |
| 3. Consolidar producción | 7 | Medio | 1, 2 |
| 4. Stock atómico | 1 | Medio | 3 |
| 5. Validar stock al producir | 2 | Medio | 4 |
| 6. Limpieza de modelo | 8, 10 | Medio (migración) | — |
| 7. Guard de auth y precisión | 6, 3 | Bajo | — |

Cada fase se entrega en un commit propio, con `npm test` y `npm run lint` en verde.

---

## Fase 1 — Tests de caracterización (punto 9)

Fijar el comportamiento actual **antes** de refactorizar.

**Archivos:** `lib/inventory.test.ts` (ya existe, ampliar).

- Mockear `db.$transaction` con un `tx` falso en memoria (o usar una DB de test; ver pregunta abierta A).
- Casos a cubrir:
  - `registrarCompraInsumo`: actualiza `costoUnidad`, suma stock en la unidad base, crea movimiento ENTRADA; rechaza unidades incompatibles e insumo/proveedor ajeno.
  - `registrarProduccionReceta`: descuenta con merma, `costoTotalProduccion` correcto, rechaza receta sin ingredientes.
  - `anularProduccion`: devuelve exactamente lo descontado; rechaza doble anulación.
  - `editarProduccion`: anula + recrea con la fecha original; rechaza producción anulada o sin receta.
  - Aislamiento: ingrediente de otro `ownerId` es rechazado.

**Verificación:** los tests pasan contra el código actual sin tocar `lib/inventory.ts`.

---

## Fase 2 — Errores tipados (punto 5)

Reemplazar `error.message.includes("no encontrada")` por clases de error.

1. Crear `lib/errors.ts`:
   - `NotFoundError`, `ValidationError` (o `DomainError`), `InsufficientStockError` (se usa en Fase 5).
   - Mismo patrón que `UnauthorizedError` en `lib/auth.ts`.
2. Cambiar los `throw new Error("... no encontrad...")` de `lib/inventory.ts` y `lib/pricing/calculateRecipeCosting.ts` a las clases nuevas.
3. Crear helper `lib/api-errors.ts` con `handleRouteError(error)` que mapea:
   - `UnauthorizedError` → 401, `NotFoundError` → 404, `DomainError` → 400, error de Prisma conocido → vía `lib/prisma-errors.ts`, cualquier otro → 500 con mensaje genérico (**no** exponer `error.message` interno).
4. Usar el helper en las rutas de `app/api/*`, empezando por `recetas/[id]/producir`, `producciones/*` y `compras-insumos`.

**Verificación:** test unitario del helper; las rutas devuelven los mismos códigos que hoy para los casos conocidos, y 500 (no 400) para errores inesperados.

---

## Fase 3 — Consolidar la lógica de producción (punto 7)

`editarProduccion` repite el cuerpo de `registrarProduccionReceta` y omite la validación de `ownerId` de los insumos.

1. Extraer en `lib/inventory.ts` (o `lib/produccion.ts`) funciones internas que reciben `tx`:
   - `crearProduccionConConsumos(tx, { ownerId, receta, unidades, fecha })`
   - `revertirMovimientosProduccion(tx, produccion, motivo)`
2. `registrarProduccionReceta`, `anularProduccion` y `editarProduccion` pasan a componerlas.
3. La validación de pertenencia de ingredientes queda en un solo lugar, por lo que `editarProduccion` la hereda.

**Verificación:** los tests de la Fase 1 siguen en verde sin modificarse; un nuevo test confirma que `editarProduccion` rechaza ingredientes de otro dueño.

---

## Fase 4 — Stock atómico (punto 1)

Hoy: leer `stockActual` → sumar/restar en JS → escribir. Dos operaciones concurrentes pierden una actualización.

1. En `lib/inventory.ts`, reemplazar el patrón read-modify-write por operaciones atómicas:
   ```ts
   tx.inventarioInsumo.update({
     where: { insumoId },
     data: { stockActual: { increment: delta } },
   });
   ```
   Usar `increment`/`decrement` en compras, movimientos, producciones, anulaciones y ediciones. `ensureInventarioInsumo` se mantiene (upsert) antes del update.
2. Para `AJUSTE` (valor absoluto con signo), `increment` con el delta sigue siendo válido.
3. Los valores devueltos (`stockActual`, `estado`) se leen del resultado del `update` atómico.
4. Test de concurrencia: ejecutar N producciones en paralelo contra una DB real de test y comprobar que el stock final es `inicial − N × consumo` (requiere la decisión A).

**Verificación:** el test de concurrencia falla en el código anterior y pasa con el nuevo.

---

## Fase 5 — Validar stock al producir (punto 2)

1. En la creación de producciones (`registrarProduccionReceta` y la parte de re-registro de `editarProduccion`), tras descontar de forma atómica, comprobar `stockActual < 0`:
   - Si hay faltante, lanzar `InsufficientStockError` con la lista de insumos faltantes (nombre, requerido, disponible). La transacción hace rollback.
2. API: `POST /api/recetas/[id]/producir` responde **409** con el detalle de faltantes.
3. UI (`RecetaDetalleModule`): mostrar los faltantes en el toast/formulario.
4. Decisión de producto (pregunta abierta B): ¿bloquear siempre, o permitir con confirmación explícita (`forzar: true`) para no frenar la operación cuando el inventario no está al día?
5. `anularProduccion` mantiene el comportamiento actual (permite stock negativo con advertencia en el modal, según el diseño de producciones).

**Verificación:** test de unidades que exceden el stock → error y sin movimientos ni producción creados.

---

## Fase 6 — Limpieza del modelo (puntos 8 y 10)

Requiere migración Prisma; hacerla de forma que no pierda datos.

**8. `Insumo.proveedor` (String) vs. modelo `Proveedor`**
1. Revisar dónde se usa el campo (`app/api/insumos`, `InsumosModule`, `seed.ts`, serializadores).
2. Migración de datos: por cada texto distinto, `upsert` de `Proveedor` por `(ownerId, nombre)`.
3. Decidir si se reemplaza por una relación o se elimina el campo (pregunta abierta C).

**10. Ventas**
- Si no hay plan a corto plazo: migración que elimine `Venta`/`VentaItem`, `EstadoVenta` y `MovimientoInventario.referenciaVentaId`.
- Si se va a implementar: abrir un documento de diseño aparte y dejar las tablas.

**Verificación:** `prisma migrate dev` sobre una copia con datos del seed; `npm run build`.

---

## Fase 7 — Guard de autenticación y precisión numérica (puntos 6 y 3)

**6. Auth en APIs**
`proxy.ts` deja pasar `/api/*` sin token y delega en `requireAuthUser`. Para que un guard olvidado no sea una brecha:
1. Test que recorre todos los `app/api/**/route.ts` y verifica que cada handler exportado llama a `requireAuthUser` (excepto `/api/auth`). Alternativa: wrapper `withAuth(handler)` que combine auth + `handleRouteError` de la Fase 2.
2. Aclarar el motivo con un comentario en `proxy.ts`.

**3. Precisión numérica**
Evaluar, sin implementar todavía, si conviene usar `Decimal` de Prisma (`decimal.js`) en `calculateRecipeCosting` y en los cálculos de inventario. Con los redondeos actuales (2 y 4 decimales) el riesgo es bajo; se reabre solo si aparecen discrepancias en reportes.

---

## Preguntas abiertas

- **A.** ¿Los tests de concurrencia usan una base PostgreSQL real de test (más fiable, requiere servicio local/CI) o solo mocks?
- **B.** ¿Producir sin stock suficiente se bloquea siempre, o se permite con confirmación?
- **C.** ¿`Insumo.proveedor` se elimina o se convierte en relación a `Proveedor`?
- **D.** ¿El módulo de Ventas está planeado a corto plazo?
- **E.** ¿El costo de la receta debe seguir usando el último precio de compra o pasar a promedio ponderado (punto 4)?

## Criterios de éxito

- `npm test` y `npm run lint` pasan en cada fase.
- Ninguna ruta devuelve `error.message` interno en errores inesperados.
- Un test de concurrencia demuestra que el stock no pierde actualizaciones.
- Producir más de lo que hay en stock no deja inventario negativo sin que el usuario lo decida.
- Un solo código produce, anula y edita producciones.
