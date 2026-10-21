# Plan de migración al diseño de Stitch (CalculaChef)

Fuente: proyecto de Stitch **Costeo-restaurante** (7 pantallas desktop + `design.md` "CalculaChef Culinary Financial System").
Estado: tokens migrados (ver `docs/design.md`). Pantallas, tablas y endpoints **aún no implementados**; este documento define cómo hacerlo, una pantalla a la vez.

## 1. Alcance y reglas

- Una pantalla por iteración, en el orden de la sección 2. Cada una se cierra (migración, endpoints, UI, tests) antes de empezar la siguiente.
- La UI sigue en español y solo tema claro.
- Sede: el selector "Bistro Central • Principal" es una **etiqueta fija**. No existe modelo `Sede`.
- Todo endpoint nuevo: `requireAuthUser()` al inicio (lo exige `lib/api-auth-guard.test.ts`), filtro por `ownerId`, validación zod en `lib/validation.ts`, errores `{ message }` en español vía `handleRouteError` (`lib/api-errors.ts`), `export const runtime = "nodejs"`.
- Decimales con `Decimal` en Prisma y `decimalToNumber`/`toPlainNumber` (`lib/serializers.ts`) al responder. Ver `docs/decisions/2026-10-10-inventory-numeric-precision.md`.
- Valores calculados (costo neto, varianza, PVP, estado) se calculan **en servidor** desde fórmulas; nunca se guardan los redondeos del diseño.
- Cada migración Prisma se crea con `npm run db:migrate` y se prueba con `npm run test:integration` cuando toque stock.

## 2. Orden de ejecución

| # | Pantalla | Ruta | Estado del código actual |
|---|---|---|---|
| 0 | Componentes compartidos | — | `components/ui/` existe; faltan Badge, KpiCard, etc. |
| 1 | Inicio: Centro de Control Financiero | `/` | Parcial: tarjetas de módulo y `AlertasInventarioCard` |
| 2 | Insumos: Catálogo y Mermas | `/insumos` (tab) | Existe `InsumosModule` |
| 3 | Insumos: Compras e Historial de Precios | `/insumos` (tab) | Existe `ComprasInsumosModule` (compra suelta) |
| 4 | Insumos: Toma de Inventario Físico | `/insumos` (tab) | `InventarioModule` solo ajusta stock mínimo y movimientos |
| 5 | Recetas: Fichas Técnicas y Escandallos | `/recetas`, `/recetas/[id]` | Existe |
| 6 | Configuración: Parámetros Globales | `/configuracion` | Existe, con 4 parámetros |
| 7 | Glosario Gastronómico | `/glosario` | No existe |

`/producciones` no tiene diseño en Stitch: solo hereda los tokens nuevos. Aparece en la navegación del diseño, así que se conserva.

## 3. Decisiones transversales (resolver antes de la pantalla 1)

### 3.1 Fórmula única de PVP
Hoy `lib/pricing/calculateSuggestedPrice.ts` usa **recargo sobre costo**:
`costo × (1 + overhead) / porciones × (1 + margen) × (1 + impuesto)`, redondeado.
Configuración de Stitch muestra **margen sobre precio**:
`costoDirecto / (1 − overhead − margen) × (1 + impuesto)`.
No dan el mismo número (ejemplo del diseño: $3.98 con 12 % y 56.2 % → $12.50 antes de impuesto, que es la segunda fórmula). Y los defaults actuales (margen 35 %) no coinciden con los del diseño (56.2 %, 65 %).

**Propuesta:** adoptar la fórmula de Stitch (margen sobre precio), actualizar `calculateSuggestedPrice` y su test, y usarla en Recetas, Configuración (simulador) y Glosario (ejemplo). El semáforo (`margenRealPct`) pasa a ser coherente con ella. **Requiere tu confirmación** (ver sección 12).

### 3.2 Estado de rentabilidad de una receta
Un solo helper `getEstadoRentabilidad(foodCostPct, config)` en `lib/pricing/`:
- `Riesgo`: food cost > `foodCostCriticoPct` (diseño: 50 % en Inicio/Recetas, 35 % en Configuración; unificar, ver sección 12).
- `Ajustar`: entre el rango objetivo y el crítico.
- `Rentable`: dentro de 28–35 %.
- `Sin dato`: sin PVP carta.
Lo consumen el dashboard, el catálogo de recetas y los badges.

### 3.3 Códigos legibles
`INS-###`, `PROV-###`, `RC-###`, `FAC-####`. Se generan en servidor con un contador por owner dentro de la transacción de creación (`MAX(codigo)+1` con restricción `@@unique([ownerId, codigo])`). Migración con backfill de los registros existentes por orden de creación.

### 3.4 Paginación y búsqueda
Los listados nuevos aceptan `?page=&pageSize=&q=` y devuelven `{ items, total, page, pageSize }`. Helper `lib/pagination.ts` (nuevo) reutilizado por todos los endpoints. Hoy los GET devuelven todo.

## 4. Pantalla 0: componentes compartidos

Crear una vez, antes del Inicio. Reutilizar `Card`, `Tabs`, `Field`, `Input`, `Button`, `EmptyState`, `ErrorState`, `LoadingState`, `ConfirmModal`.

| Componente | Archivo | Uso |
|---|---|---|
| `MainNav` rediseñado | `components/MainNav.tsx` | Marca, etiqueta de sede fija, nav (Inicio, Insumos, Recetas, Producciones, Configuración), "Guía de Costeo" (enlace al Glosario), usuario con rol y "Cerrar sesión" |
| `Badge` / `StatusBadge` | `components/ui/Badge.tsx` | Rentable, Ajustar, Riesgo, Sin dato, Crítico, Reorden; punto + texto, usando `--success-*`, `--warning-*`, `--danger-*` |
| `KpiCard` | `components/ui/KpiCard.tsx` | Título en mayúsculas `label-sm`, valor `kpi-value`, pastilla de tendencia |
| `EducationalCallout` | `components/ui/EducationalCallout.tsx` | Caja azul `--info-*` con ícono y enlace a la guía |
| `Pagination` | `components/ui/Pagination.tsx` | "Mostrando X de Y", páginas, anterior/siguiente |
| `Tooltip` | `components/ui/Tooltip.tsx` | Superficie `--ink`, texto blanco 12 px, foco accesible |
| `AppFooter` | `components/AppFooter.tsx` | © año, enlace al Glosario |

Archivos a tocar: `components/PageContainer.tsx` (ancho máximo `76rem`, hoy `max-w-6xl`), `app/layout.tsx` (ya carga Inter).
Datos: el rol hoy no existe en `User`. El diseño muestra "Administrador": mostrar texto fijo hasta que haya roles (no se crea tabla).
Verificación: `npm run lint`, revisión visual de `/login` y `/` con el navegador integrado.

## 5. Pantalla 1: Inicio, Centro de Control Financiero

**Diseño:** 4 KPI (Food Cost promedio con variación m/m; Margen de contribución vs objetivo; Recetas en riesgo "X de Y"; Stock crítico), tarjeta educativa de Food Cost ideal vs real, 3 tarjetas de módulo con conteos (Insumos y Mermas, Fichas Técnicas, Estructura Financiera), panel de alertas con tabs Todas/Críticas/Reorden y botón "Pedir", semáforo de rentabilidad con recomendación, acciones Descargar P&L / Nueva Receta / Registrar Compra.

**Archivos actuales:** `app/page.tsx`, `components/inventario/AlertasInventarioCard.tsx`, `app/api/inventario/alertas/route.ts`.

**Brechas de datos**
| Dato | Existe | Qué falta |
|---|---|---|
| Alertas de stock | Sí (`getEstadoReposicion`) | % de desviación y estado `Crítico`/`Reorden sugerido` con los mismos umbrales que el diseño |
| Food cost promedio | No | Agregado sobre `calculateRecipeCosting` de todas las recetas |
| Variación m/m | No | Histórico: ver tabla nueva |
| Recetas en riesgo | No | Helper 3.2 |
| Conteos (insumos, con merma, recetas) | No | Consultas `count` |
| Parámetros financieros | Parcial | `ConfiguracionCosteo` (pantalla 6) |

**Tabla nueva**
```prisma
model SnapshotCosteoMensual {
  id             String   @id @default(cuid())
  ownerId        String
  periodo        String   // "2026-10"
  foodCostPct    Decimal  @db.Decimal(5, 2)
  margenPct      Decimal  @db.Decimal(5, 2)
  recetasActivas Int
  recetasRiesgo  Int
  creadoEn       DateTime @default(now())
  @@unique([ownerId, periodo])
}
```
Se escribe al consultar el dashboard si no existe el del mes anterior (calculado con el costo actual), y se actualiza al cerrar una toma de inventario. Alternativa más simple si no quieres tabla: mostrar el KPI sin delta m/m. Ver sección 12.

**Endpoints nuevos**
- `GET /api/dashboard` → `{ foodCost: {valor, deltaMensual, rango}, margen: {valor, deltaVsObjetivo}, recetas: {activas, enRiesgo, aRevisar}, insumos: {total, conMerma, criticos, reorden}, finanzas: {margenObjetivo, overhead}, semaforo: [{recetaId, nombre, estado, margenPct, pvp, costo, foodCostPct}] }`.
- `GET /api/inventario/alertas` ampliar con `desviacionPct`, `estado` y `proveedorPreferido` (para "Pedir").

**Cambios de UI:** reemplazar las tres tarjetas actuales por KPI + módulos + alertas con `Tabs` + semáforo. "Pedir" abre `/insumos?tab=compras&insumoId=…` (enlace, sin orden de compra). "Registrar Compra" y "Nueva Receta" son enlaces. "Descargar P&L" queda **deshabilitado** con tooltip "Próximamente" (fase posterior).

**Verificación:** test unitario de `getEstadoRentabilidad`; test del agregado con datos en memoria; revisar `/` con 0 recetas (EmptyState) y con datos del seed.
**Inconsistencias del diseño:** rango 28–32 % (texto) vs 28–35 % (badge); la pestaña "Críticas (2)" vs ítem "Bajo stock" sin categoría definida. Usar 28–35 % y tres estados: Crítico, Bajo stock/Reorden, Sano.

## 6. Pantalla 2: Insumos, Catálogo de Materias Primas y Mermas

**Diseño:** cabecera "Gestión de Insumos y Materias Primas" con Importar CSV/Factura y Nuevo Insumo; tabs Insumos/Compras/Toma de Inventario; callout de merma (`Costo Neto = Costo Bruto / (1 − %Merma)`); formulario Registrar/Editar (nombre, categoría, unidad base, proveedor); calculadora de prorrateo; panel de merma con presets 0/15/40 %; 3 KPI; tabla (código, categoría, presentación y proveedor, recetas vinculadas, merma y rendimiento, costo neto real, acciones); paginación.

**Archivos actuales:** `components/insumos/InsumosModule.tsx`, `InsumosWorkspace.tsx`, `app/api/insumos/route.ts`, `app/api/insumos/[id]/route.ts`, `lib/unit-conversion.ts` (`calculateUnitCostFromPurchase`).

**Brechas y migración (`Insumo`, `Proveedor`)**
| Campo | Cambio |
|---|---|
| `Insumo.codigo` | nuevo, `@@unique([ownerId, codigo])`, backfill |
| `Insumo.categoria` | de `String` a enum `CategoriaInsumo` (PROTEINAS_CARNES, LACTEOS_QUESOS, FRUTAS_VERDURAS, ABARROTES_SECOS, EMPAQUES_DESECHABLES, BEBIDAS_LICORES). Migración con mapeo de valores existentes a "ABARROTES_SECOS" por defecto y lista de los que no calzan para revisión manual |
| `Insumo.presentacionCantidad`, `presentacionUnidad`, `precioPresentacion` | nuevos y opcionales (presentación de compra mostrada en tabla) |
| `Insumo.activo` | nuevo, default `true` |
| `Proveedor.codigo`, `Proveedor.activo` | nuevos |

**Endpoints**
- `GET /api/insumos` con paginación, `q`, `categoria`, `proveedorId`; cada item incluye `costoNetoReal` (calculado), `rendimientoPct` y `recetasVinculadas` (`count` sobre `RecetaInsumo`).
- `GET /api/insumos/resumen` → `{ activos, mermaPromedioPct, proveedoresActivos, proveedoresConVariacion }`.
- `POST /api/insumos/importar` (CSV) → valida filas, devuelve `{ creados, errores: [{fila, motivo}] }`. La importación de **factura** va en la pantalla 3.
- Reutilizar `POST /api/insumos`, `PATCH /api/insumos/[id]` ampliando `insumoSchema`.

**Cambios de UI:** `InsumosModule` pasa a layout de dos columnas (rail de formulario/calculadora de 380 px + tabla). Calculadora y merma son cálculos de cliente con las mismas funciones de `lib/unit-conversion.ts` (no duplicar la fórmula). El costo neto mostrado viene siempre del servidor; el diseño tiene redondeos inconsistentes (p. ej. pechuga $0.0105 vs $0.0106).

**Verificación:** tests de `costoNetoReal`, de la migración de categoría (script contra datos de seed), del CSV (filas válidas e inválidas); revisar paginación y estado vacío.
**Riesgo:** convertir `categoria` a enum puede dejar datos viejos sin mapear; hacer la migración en dos pasos (columna nueva, backfill, borrar la vieja).

## 7. Pantalla 3: Insumos, Compras e Historial de Precios

**Diseño:** panel "Cultura de Costeo" (PPP); formulario de factura con proveedor (+ Nuevo), N° factura/remisión, fecha, condición de pago (contado, crédito 15/30 con vencimiento calculado), líneas repetibles (insumo, cantidad, unidad, precio bruto, IVA 0/5/19 %, total de línea, variación vs última compra), checkbox "Actualizar costos base en recetas vinculadas", subtotal/IVA/total, Guardar Borrador / Registrar y Aplicar; 4 KPI del mes; radar de variación de precios (72 h); historial con búsqueda, período, proveedor, paginación.

**Archivos actuales:** `components/compras/ComprasInsumosModule.tsx`, `app/api/compras-insumos/route.ts`, `app/api/insumos/[id]/historial-precios/route.ts`, `registrarCompraInsumo` en `lib/inventory.ts`.

**Tablas nuevas**
```prisma
enum TipoDocumentoCompra { FAC REM }
enum EstadoFactura { BORRADOR APLICADA }
enum CondicionPago { CONTADO CREDITO_15 CREDITO_30 }

model FacturaCompra {
  id               String   @id @default(cuid())
  ownerId          String
  proveedorId      String
  tipo             TipoDocumentoCompra
  numero           String
  fechaEmision     DateTime
  condicionPago    CondicionPago
  fechaVencimiento DateTime?
  estado           EstadoFactura @default(BORRADOR)
  actualizaCostos  Boolean  @default(true)
  subtotal         Decimal  @db.Decimal(14, 4)
  impuestos        Decimal  @db.Decimal(14, 4)
  total            Decimal  @db.Decimal(14, 4)
  lineas           FacturaCompraLinea[]
  @@unique([ownerId, tipo, numero])
  @@index([ownerId, fechaEmision])
}

model FacturaCompraLinea {
  id                  String  @id @default(cuid())
  facturaId           String
  insumoId            String
  cantidad            Decimal @db.Decimal(14, 4)
  unidad              UnidadBase
  precioUnitarioBruto Decimal @db.Decimal(14, 4)
  tasaImpuestoPct     Decimal @db.Decimal(5, 2)
  totalLinea          Decimal @db.Decimal(14, 4)
  compraInsumoId      String? // se llena al aplicar
}
```
`CompraInsumo` se conserva como historial de precios: al **aplicar** la factura se crea una por línea con `registrarCompraInsumo` dentro de la misma transacción (stock y costo se actualizan de forma atómica, como hoy). Un borrador no toca stock ni costos.
`Proveedor` gana `activo` y `codigo` (pantalla 2).

**Endpoints nuevos**
- `GET /api/facturas-compra` (filtros `desde`, `hasta`, `proveedorId`, `q`, paginación) y `POST` (crea borrador o aplicada).
- `GET|PATCH|DELETE /api/facturas-compra/[id]` (solo borrador editable/eliminable) y `POST /api/facturas-compra/[id]/aplicar`.
- `GET /api/compras-insumos/resumen?mes=` → `{ gasto, variacionVsMesAnterior, facturas, proveedores, alertasVariacion }`.
- `GET /api/insumos/variaciones-precio?horas=72` → por insumo: precio anterior y actual, % de cambio, recetas afectadas (`RecetaInsumo`) y food cost antes/después.
- `POST /api/proveedores` ya existe (botón "+ Nuevo").

**Cambios de UI:** reemplazar el formulario de compra suelta por el de factura con líneas (`react-hook-form` `useFieldArray`, ya usado en el proyecto). Radar como tres tarjetas. Historial con `Pagination`.

**Fuera de alcance (documentado):** "Importar Factura XML/PDF" (deshabilitado con tooltip). "Ahorro/Negociación detectada" requiere precio de lista; se omite el KPI o se añade `FacturaCompraLinea.precioLista` opcional (ver sección 12). Política PPP vs FIFO: hoy el costo del insumo es el de la última compra; PPP real requiere recalcular con stock: queda como mejora, con el texto educativo ajustado a lo que el sistema hace.

**Verificación:** tests de aplicar factura (transacción, stock, costos, idempotencia, rollback si falla una línea) en el estilo de `lib/inventory.transactions.test.ts`; integración `npm run test:integration`; test del guard de autenticación pasa solo.
**Inconsistencia del diseño:** el umbral de alerta es 10 % en el radar y 15 % en Configuración. Se usa uno solo, `umbralVolatilidadPct`.

## 8. Pantalla 4: Insumos, Toma de Inventario Físico y Conciliación

**Diseño:** 4 KPI (valor inventariado, varianza global neta, discrepancias críticas, progreso de conteo); tabs por área; búsqueda, familia, "Solo con discrepancia"; tabla de conciliación (insumo y ubicación, costo neto, stock teórico, stock físico editable, diferencia y varianza, impacto económico, justificación, historial); observaciones; resumen de faltantes/sobrantes y ajuste neto; Guardar Progreso / Finalizar Auditoría; Imprimir, Historial, Cerrar y Ajustar.

**Archivos actuales:** `components/inventario/InventarioModule.tsx`, `app/api/movimientos-inventario/route.ts`, `app/api/insumos/[id]/inventario/route.ts`, `registrarMovimientoInventario` en `lib/inventory.ts`, `lib/inventory-rules.ts`.

**Dato verificado:** `getDeltaFromMovimiento` trata `AJUSTE` como **delta con signo** (no valor absoluto). El cierre debe enviar `AJUSTE` con `cantidad = físico − teórico`.

**Tablas nuevas**
```prisma
enum EstadoToma { EN_CURSO CERRADA }
enum MotivoVarianza { SOBREPORCIONADO MERMA_EXTRA VENTA_NO_REGISTRADA DETERIORO ERROR_CONTEO OTRO }

model AreaAlmacen {
  id      String @id @default(cuid())
  ownerId String
  nombre  String
  orden   Int    @default(0)
  @@unique([ownerId, nombre])
}

model TomaInventario {
  id            String   @id @default(cuid())
  ownerId       String
  periodo       String   // "2026-10"
  estado        EstadoToma @default(EN_CURSO)
  observaciones String?
  firmadoPor    String?
  abiertaEn     DateTime @default(now())
  cerradaEn     DateTime?
  conteos       ConteoInsumo[]
  @@unique([ownerId, periodo])
}

model ConteoInsumo {
  id              String   @id @default(cuid())
  tomaId          String
  insumoId        String
  stockTeorico    Decimal  @db.Decimal(14, 4)  // congelado al abrir
  costoUnitario   Decimal  @db.Decimal(14, 4)  // congelado al abrir
  stockFisico     Decimal? @db.Decimal(14, 4)  // null = pendiente
  contadoPor      String?
  contadoEn       DateTime?
  motivo          MotivoVarianza?
  nota            String?
  @@unique([tomaId, insumoId])
}
```
`Insumo` gana `sku` (opcional, único por owner) y `areaId` (FK a `AreaAlmacen`, opcional). Seed con áreas: Cámara Fría, Bodega Seca, Barra, Cocina Caliente.

**Endpoints nuevos**
- `GET /api/areas-almacen`, `POST /api/areas-almacen`.
- `GET /api/tomas-inventario` (historial), `POST /api/tomas-inventario` (abre y congela teórico y costo de todos los insumos activos; 409 si ya hay una en curso).
- `GET /api/tomas-inventario/[id]` → KPI, filas filtrables (`area`, `familia`, `q`, `soloDiscrepancia`, paginación) y resumen financiero.
- `PATCH /api/tomas-inventario/[id]/conteos` → guarda uno o varios conteos (guardado automático, no toca stock).
- `POST /api/tomas-inventario/[id]/cerrar` → exige justificación en toda varianza mayor al umbral crítico; en una transacción crea movimientos `AJUSTE` con `motivo = "Toma de inventario <periodo>"` y marca `CERRADA`. Rechaza si quedan conteos pendientes salvo `?forzar=true` (los pendientes no generan ajuste).

**Reglas:** varianza % = (físico − teórico) / teórico × 100; impacto = diferencia × costo; ≤ `toleranciaInventarioPct` (2 %) "Tolerancia OK"; ≥ `criticoInventarioPct` (5 %) "Crítico". Umbrales viven en `ConfiguracionCosteo` (pantalla 6).

**Cambios de UI:** `InventarioModule` pasa a tabla de conciliación con input de conteo por fila (debounce + PATCH), badges de estado y barra de acciones. Impresión con `window.print()` y una hoja `@media print`; "Escala" del diseño no se implementa.

**Verificación:** tests de cálculo (varianza, umbrales), de apertura (congelado), de cierre (movimientos AJUSTE con signo correcto, atomicidad, no doble cierre) y de integración contra BD real.
**Inconsistencia del diseño:** las celdas de stock físico aparecen vacías pero con diferencias calculadas. Aquí `null` significa pendiente y no muestra diferencia.

## 9. Pantalla 5: Recetas, Fichas Técnicas y Escandallos

**Diseño:** 4 KPI (activas, food cost promedio, margen de contribución, requieren revisión); editor de ficha (nombre, categoría, rendimiento, tiempo, PVP carta, líneas con insumo/sub-receta, cantidad, unidad, costo) con panel de escandallo en vivo (costo total, por porción, overhead, PVP sugerido); catálogo con tabs Todas/Rentables/En Riesgo, búsqueda, categoría, duplicar; insight de ingeniería de menú; importar recetario.

**Archivos actuales:** `components/recetas/RecetasModule.tsx`, `RecetaDetalleModule.tsx`, `app/api/recetas/**`, `lib/pricing/calculateRecipeCosting.ts`, `calculateSuggestedPrice.ts`.

**Brechas y migración (`Receta`, `RecetaInsumo`)**
| Campo | Cambio |
|---|---|
| `Receta.codigo` | nuevo (`RC-###`), backfill |
| `Receta.categoria` | enum `CategoriaReceta` (HAMBURGUESAS, ENTRADAS_TAPAS, PLATOS_FUERTES, PASTAS_PIZZAS, COCTELERIA_BARRA, POSTRES). Hoy existe `tipoProducto` (texto): migrar valores y retirarlo |
| `Receta.borrador` | `Boolean @default(false)` |
| `Receta.activa` | `Boolean @default(true)` |
| `RecetaInsumo.subRecetaId` | opcional; `insumoId` pasa a opcional; check: exactamente uno de los dos. Detección de ciclos al guardar |

**Endpoints**
- `GET /api/recetas` con paginación, `q`, `categoria`, `estado` (`rentable|ajustar|riesgo`); cada item con `costoPorcion`, `pvpCarta`, `pvpSugerido`, `foodCostPct`, `estado`, `nInsumos`.
- `GET /api/recetas/resumen` (KPI).
- `POST /api/recetas/[id]/duplicar`.
- `POST /api/recetas/importar` (CSV/Excel) con reporte de errores por fila.
- `GET /api/recetas/[id]/costeo` ampliar con desglose por línea (costo neto por unidad, merma) y sub-recetas.

**Cambios de UI:** catálogo en tarjetas con `StatusBadge`; editor con `useFieldArray`; panel de escandallo en vivo calcula con `calculateSuggestedPrice` (la fórmula única de 3.1). Callout de ingeniería de menú: texto derivado del peor food cost (sin matriz BCG real, que requiere ventas y se eliminó el esquema de ventas).

**Verificación:** ampliar `calculateSuggestedPrice.test.ts` con el caso del diseño; tests de ciclos de sub-recetas; revisar que producir una receta con sub-recetas descuente stock de los insumos finales (`registrarProduccionReceta`).
**Inconsistencias del diseño:** categorías distintas entre filtro y editor (se usa la lista del editor, que incluye Postres); Pizza Margarita con PVP sugerido menor que PVP carta (válido, no es error); "24 recetas, 3 páginas" con 4 por página (se pagina de verdad); PVP sugerido $13.60 no reproducible (ver 3.1).
**Riesgo:** las sub-recetas cambian el modelo de costeo y de producción; si se prefiere diferir, dejarlas fuera de esta iteración y mostrar la opción deshabilitada.

## 10. Pantalla 6: Configuración, Parámetros Globales de Costeo

**Diseño:** overhead (slider 5–30 %), margen objetivo (slider con atajos 40/56.2/65/75 %), régimen tributario (8 % impoconsumo, 19 % IVA, 0 % exento), política de redondeo (centena, cincuenta, millar, sin redondeo), umbrales de food cost crítico y margen mínimo, alertas por volatilidad de compra (toggle y umbral), simulador de impacto en PVP, registro de calibraciones, Restaurar Valores / Guardar.

**Archivos actuales:** `components/configuracion/ConfiguracionModule.tsx`, `app/api/configuracion-costeo/route.ts`, `configuracionCosteoSchema` en `lib/validation.ts`.

**Migración (`ConfiguracionCosteo`)**
| Campo nuevo | Default |
|---|---|
| `regimenTributario` (enum `IMPOCONSUMO_8`, `IVA_19`, `EXENTO`) | `IMPOCONSUMO_8` (mantiene `impuestoPct` sincronizado) |
| `foodCostCriticoPct` | 35 |
| `margenMinimoPct` | 40 |
| `alertaVolatilidadActiva` | `true` |
| `umbralVolatilidadPct` | 15 |
| `toleranciaInventarioPct` | 2 |
| `criticoInventarioPct` | 5 |

Defaults de `overheadPct` y `margenObjetivoPct`: el diseño usa 12 % y 56.2 %; el esquema 10 % y 35 %. No se cambian los valores de usuarios existentes; solo el default para owners nuevos (ver sección 12).

**Tabla nueva**
```prisma
model ConfiguracionCosteoAuditoria {
  id            String   @id @default(cuid())
  ownerId       String
  campo         String
  valorAnterior String
  valorNuevo    String
  usuarioId     String
  creadoEn      DateTime @default(now())
  @@index([ownerId, creadoEn])
}
```

**Endpoints**
- `PATCH /api/configuracion-costeo` ampliar y escribir una fila de auditoría por campo cambiado, en la misma transacción.
- `GET /api/configuracion-costeo/auditoria?limit=` .
- `POST /api/configuracion-costeo/restaurar` (vuelve a los defaults del diseño, con auditoría).
- `GET /api/configuracion-costeo/simulacion?recetaId=` (plato de calibración; desglose de PVP con la fórmula 3.1).

**Cambios de UI:** sliders accesibles (`input type=range` con `aria-valuetext`) más campo numérico; simulador reactivo en cliente con `calculateSuggestedPrice` y verificación contra el endpoint. Aviso de que recalcula los PVP sugeridos al leerlos (no hay job; los PVP de carta no cambian).
**Fuera de alcance (documentado):** sincronización con POS/TPV, emails de volatilidad, flujo de aprobación del Chef Ejecutivo por margen < 40 %. El toggle y el umbral se guardan y alimentan el radar de la pantalla 3, pero no envían correos.

**Verificación:** tests del PATCH con auditoría; test del simulador contra el ejemplo del diseño ($3.98 → $12.50 → $13.50); revisar "Restaurar Valores".

## 11. Pantalla 7: Glosario Gastronómico

**Diseño:** breadcrumb Inicio › Configuración › Glosario; encabezado con versión de norma; fórmula maestra de rentabilidad con ejemplo; matriz de ingeniería de menú (Estrellas, Caballos, Puzzles, Perros); 8 términos con búsqueda y chips de categoría; estado vacío; manual operativo en PDF.

**Archivos nuevos:** `app/glosario/page.tsx`, `lib/glosario.ts` (datos estáticos), `components/glosario/GlosarioModule.tsx`. Entrada "Glosario Gastronómico" en el footer y "Guía de Costeo" en la nav (`components/MainNav.tsx`).
**Datos:** sin tabla ni endpoint. `lib/glosario.ts` exporta `CATEGORIAS_GLOSARIO` (unión literal) y `TERMINOS_GLOSARIO` tipados; búsqueda y filtro en cliente.
**Ejemplo numérico:** se calcula con `calculateSuggestedPrice` (fórmula 3.1) en vez de texto fijo, porque el ejemplo del diseño no suma (≈ $11,406 vs $12,300).
**Contenido a revisar antes de publicar:** la frase "evita el 68 % de quiebras" no tiene fuente: se retira o se cita. Rangos (merma 75–92 %, varianza < 1.8 % frente a 2 % en inventario) deben coincidir con Configuración; usar los valores de `ConfiguracionCosteo` como referencia o aclarar que son orientativos.
**Descargas:** "Descargar PDF" y "Descargar Manual PDF" quedan deshabilitados hasta contar con los archivos.
**Verificación:** test de filtrado (categoría + texto + estado vacío), revisión visual y de navegación por teclado en los chips.

## 12. Preguntas abiertas

1. **Fórmula de PVP:** ¿pasamos a margen sobre precio (Stitch) o conservamos recargo sobre costo (actual)? Cambia el PVP sugerido de todas las recetas.
2. **Umbrales:** food cost crítico es 50 % en Inicio/Recetas y 35 % en Configuración; variación de precio es 10 % en Compras y 15 % en Configuración. ¿Cuál vale?
3. **Variación m/m del Inicio:** ¿tabla `SnapshotCosteoMensual` o sin delta mensual por ahora?
4. **KPI "Ahorro/Negociación":** ¿añadimos `precioLista` en las líneas de factura o lo quitamos?
5. **Sub-recetas:** ¿entran en la pantalla 5 o se difieren?
6. **Defaults para owners nuevos:** overhead 12 % y margen 56.2 % (diseño) o 10 % y 35 % (actual).
7. **Roles:** "Administrador" es texto fijo. ¿Se necesita un campo `rol` en `User`?

## 13. Orden consolidado de migraciones Prisma

1. `codigos_legibles`: `Insumo.codigo`, `Proveedor.codigo`, `Receta.codigo` + backfill.
2. `insumo_categoria_enum`: enum y backfill de `Insumo.categoria`; `presentacion*`, `activo`, `Proveedor.activo`.
3. `facturas_compra`: `FacturaCompra`, `FacturaCompraLinea` y enums.
4. `configuracion_costeo_ampliada`: columnas nuevas y `ConfiguracionCosteoAuditoria`.
5. `toma_inventario`: `AreaAlmacen`, `TomaInventario`, `ConteoInsumo`, `Insumo.sku`, `Insumo.areaId`.
6. `receta_categoria_subrecetas`: `Receta.categoria/borrador/activa`, `RecetaInsumo.subRecetaId`.
7. `snapshot_costeo_mensual` (si se aprueba).

Cada migración se aplica y prueba (`npm run db:migrate`, `npm test`, `npm run test:integration`) antes de seguir; la pantalla N solo usa migraciones 1..N que ya estén aplicadas.

## 14. Verificación global

- `npm run lint`, `npm test` y `npm run test:integration` en verde al cerrar cada pantalla.
- `lib/api-auth-guard.test.ts` pasa con cada ruta nueva.
- Revisión visual con el navegador integrado en 1280 px y 375 px: sin scroll horizontal, controles de 44 px, contraste AA.
- Búsqueda de hex antiguos (`#faf8f5`, `#1c1917`, `#b45309`, `#292524`) en `app/` y `components/`: sin resultados.
- Estados vacío, error y carga presentes en cada listado.

## 15. Pantalla 8 (adición post-migración): Ventas y Mezcla de Menú

Añadida después del cierre de las pantallas 1–7, a partir de una pantalla nueva generada en el proyecto de Stitch (`projects/11494162470921573572/screens/1ade8c304ffa4651bec1bc0ce6f8f84a`, título "Ventas y Mezcla de Menú"). Reabre, de forma acotada, el hueco documentado en la pantalla 5 ("sin matriz BCG real, que requiere ventas y se eliminó el esquema de ventas"): registra **unidades vendidas por receta y periodo** — sin integración POS, sin ticket, sin relación con `Produccion` ni con inventario — para calcular el margen de contribución total y clasificar cada receta en la matriz de ingeniería de menú (Miller & Kasavana).

**Diseño:** ruta de nav "Mezcla" (entre Recetas y Producciones); selector de periodo (mes/año); botones "Descargar Reporte" e "Importar ventas (CSV)" (ambos fuera de alcance esta iteración); 4 KPI (Unidades Vendidas del periodo, Food Cost Ponderado, Mayor Impacto Económico, Recetas sin Dato de Ventas); callout educativo "Popularidad × Rentabilidad"; filtro por categoría y orden (Margen Total / Unidades / Food Cost % / Alfabético); tabla editable (receta y código, categoría, unidades vendidas con stepper, costo por porción, PVP carta, margen unitario, margen total, food cost %, badge de cuadrante) con botón "Guardar Unidades"; fila de totales; cuatro paneles de cuadrante (Estrellas, Caballos de Batalla, Puzzles, Perros) listando las recetas de cada uno con su estrategia recomendada.

**Inconsistencias del diseño (resueltas para la implementación):**
- El mockup calcula food cost % y margen unitario sobre el PVP bruto (`costoPorcion / pvpCarta`). El resto de la app (`costRecipe` en `lib/receta-service.ts`, dashboard) calcula food cost % sobre el precio neto de impuesto. **Se usa la fórmula existente de `costRecipe`** para esta pantalla, por consistencia con Recetas y el Inicio; los números no coincidirán centavo a centavo con el mockup.
- El mockup dibuja la matriz como una dispersión 2×2 real. El HTML generado en realidad la implementa como **cuatro tarjetas de cuadrante con listas**, no un scatter plot — se implementa tal cual el HTML (más simple, sin librería de gráficos nueva).
- "Descargar Reporte" e "Importar ventas (CSV)" quedan **deshabilitados con tooltip "Próximamente"**, igual que "Descargar P&L" en la pantalla 1.

**Tabla nueva**
```prisma
model VentaReceta {
  id               String   @id @default(cuid())
  ownerId          String
  recetaId         String
  periodo          String   // "2026-10"
  unidadesVendidas Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  owner            User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  receta           Receta   @relation(fields: [recetaId], references: [id], onDelete: Cascade)

  @@unique([ownerId, recetaId, periodo])
  @@index([ownerId, periodo])
}
```
Una fila **ausente** para una receta en el periodo significa "sin dato" (pendiente); una fila con `unidadesVendidas = 0` significa que se registró explícitamente que no tuvo ventas. Ambas se excluyen del promedio de popularidad y del promedio de margen que fijan los umbrales de la matriz (si no hay recetas con ventas registradas, no hay umbrales ni cuadrantes).

**Cálculos (en servidor, reutilizando `costRecipe`)**
- `margenUnitario = ventaNeta - costoPorcion` (neto de impuesto, no bruto — consistente con `foodCostPct` y con el resto de la app; null si la receta no tiene PVP de carta).
- `margenTotal = margenUnitario * unidadesVendidas`.
- `foodCostPct`: el mismo campo que ya calcula `costRecipe` (neto de impuesto).
- Food Cost Ponderado del periodo = `Σ(costoPorcion × unidades) / Σ(ventaNeta × unidades) × 100`, solo sobre recetas con PVP y con fila de ventas.
- Umbral de popularidad = promedio simple de `unidadesVendidas` sobre recetas con fila de ventas; umbral de margen = promedio simple de `margenUnitario` sobre esas mismas recetas.
- Cuadrante: Estrella (unidades ≥ umbral, margen ≥ umbral) · Caballo de Batalla (unidades ≥ umbral, margen < umbral) · Puzzle (unidades < umbral, margen ≥ umbral) · Perro (unidades < umbral, margen < umbral). Sin fila o sin PVP ⇒ "Sin dato".

**Endpoints nuevos**
- `GET /api/ventas-recetas?periodo=2026-10` → `{ periodo, kpis: {...}, items: [...], cuadrantes: {...}, umbrales: {...} }`. Sin paginación (mismo criterio que `/api/dashboard`: una sola carga para todas las recetas activas del owner).
- `PATCH /api/ventas-recetas` body `{ periodo, items: [{ recetaId, unidadesVendidas }] }` (máx. 200 líneas) → upsert transaccional por fila, verificando que cada `recetaId` pertenezca al `ownerId` antes de escribir.

**Cambios de UI:** nueva ruta `/mezcla`, entrada "Mezcla" en `components/MainNav.tsx` entre Recetas y Producciones; `components/mezcla/MezclaMenuModule.tsx` con selector de periodo, KPI (`KpiCard`), `EducationalCallout`, filtro de categoría + orden, tabla con stepper local (sin auto-guardado) y botón "Guardar Unidades" que dispara el `PATCH`, fila de totales, y los cuatro paneles de cuadrante. Reutiliza `Badge` (variantes nuevas para Estrella/Caballo/Puzzle/Perro/Sin dato), `EmptyState` (sin recetas activas) y `LoadingState`/`ErrorState`.

**Fuera de alcance (documentado):** importar ventas por CSV, descarga de reporte, integración con POS/TPV, vínculo con `Produccion` o con stock.

**Verificación:** tests de clasificación de cuadrante y de food cost ponderado con datos en memoria; test de integración del `PATCH` (transacción, scoping por `ownerId`, rechazo de `recetaId` ajeno); `lib/api-auth-guard.test.ts` cubre la ruta nueva; revisión visual de `/mezcla` con 0 ventas registradas (EmptyState) y con datos del seed.

**Migración Prisma:** `venta_receta` (añadida al final del orden de la sección 13, no reordena las migraciones 1–7 ya aplicadas).
