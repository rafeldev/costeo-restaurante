# Diseño: SaaS + POS para restaurantes individuales

**Fecha:** 2025-02-20  
**Estado:** Validado

## Resumen

El producto se orienta a **restaurantes individuales** (un local por cuenta). Se mantiene el modelo actual (User = restaurante, sin Organización ni Local). Se agrega POS (punto de venta) integrado con recetas e inventario, y más adelante el sitio se migra a un dashboard y se añade cobro recurrente (SaaS).

## Decisiones de alcance

| Tema | Decisión |
|------|----------|
| Cliente objetivo | Restaurantes individuales (no cadenas por ahora) |
| Modelo de datos | Mínimo: sin Organización ni Local; todo con `ownerId` |
| Roles | Un solo tipo de usuario (dueño/admin) que ve todo |
| Catálogo | Centralizado por usuario (insumos, recetas, proveedores) |
| UI futura | Migrar todo el sitio a un dashboard (sidebar, secciones) |

## Arquitectura actual (sin cambios)

- **Usuario = restaurante.** Un User = un tenant; todos los datos por `ownerId`.
- **Catálogo:** Insumo, Receta, RecetaInsumo, Proveedor, ConfiguracionCosteo.
- **Inventario:** InventarioInsumo, MovimientoInventario, CompraInsumo.
- **Auth:** NextAuth + email/password.

No se agregan tablas Organización ni Local.

## POS: alcance y modelo de datos

**Funcionalidad:**

- Armar una venta (ticket): agregar ítems desde Recetas (platos/bebidas con precio).
- Cada ítem: cantidad, precio (desde receta, editable al momento).
- Cerrar/cobrar venta → se persiste; opcionalmente se descuenta inventario según recetas.

**Modelo propuesto:**

- **Venta** (o Ticket): `id`, `ownerId`, `fechaHora`, `total`, `estado` (ABIERTA | CERRADA | CANCELADA), `createdAt`, `updatedAt`. Opcional: `mesa`, `notas`.
- **VentaItem:** `id`, `ventaId`, `recetaId`, `cantidad`, `precioUnitario`, `subtotal` (o calculado). Relación con Venta y Receta.

**Flujo:**

1. Crear Venta (estado ABIERTA).
2. Agregar VentaItems (Receta + cantidad; precio desde Receta, override permitido).
3. Cerrar venta → estado CERRADA.
4. Opcional: al cerrar, por cada VentaItem descontar inventario según RecetaInsumo (SALIDA, motivo "Venta", referencia a venta).

## Dashboard (fase posterior)

- Migrar el sitio a layout tipo dashboard: sidebar, secciones (Insumos, Recetas, Inventario/Compras, Configuración, Caja/POS).
- Integrar costeo, inventario y POS en la misma navegación.

## SaaS (fase posterior)

- Planes (ej. Básico / Pro) y facturación con Stripe (o similar).
- Onboarding y, si aplica, límites por plan (ej. número de recetas, POS en plan Pro).

## Orden de implementación

1. **POS en datos y API** — Modelo Venta + VentaItem, flujo básico de caja, cerrar venta. Opcional: descuento de inventario al cerrar.
2. **Dashboard** — Layout con sidebar y rutas por sección; migrar pantallas existentes.
3. **UI del POS** — Vista de caja dentro del dashboard: agregar ítems desde recetas, carrito, cobrar.
4. **SaaS** — Planes, Stripe, límites, onboarding.

---

*Documento generado a partir del brainstorming validado. Antes de implementar, avisar antes de tocar código.*
