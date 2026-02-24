# Diseño: Historial y gestión de producciones

**Fecha:** 2025-02-24  
**Objetivo:** Dar visibilidad a las producciones registradas, permitir anular y editar, y mostrar métricas de costo acumulado. Dos vistas: global (sidebar) y por receta (detalle).

---

## 1. Modelo de datos

### Nuevo modelo `Produccion`

| Campo                 | Tipo             | Notas                                          |
|-----------------------|------------------|-------------------------------------------------|
| id                    | String (cuid)    | PK                                              |
| ownerId               | String           | FK → User                                       |
| recetaId              | String           | FK → Receta (nullable si receta se elimina)     |
| recetaNombre          | String           | Snapshot del nombre al momento de producir       |
| unidades              | Int              | Unidades producidas                              |
| costoTotalProduccion  | Decimal(12,2)    | Suma del costo de insumos consumidos             |
| estado                | Enum             | ACTIVA, ANULADA                                  |
| fechaProduccion       | DateTime         | Fecha/hora de la producción                      |
| createdAt             | DateTime         |                                                  |
| updatedAt             | DateTime         |                                                  |

Relaciones:
- `Produccion` → `MovimientoInventario[]` (movimientos generados por esta producción).
- `Produccion` → `Receta` (opcional, puede ser null si la receta se borra).
- `Produccion` → `User` (owner).

### Cambios en `MovimientoInventario`

- Nuevo campo opcional `produccionId: String?` → FK a `Produccion`.
- Índice en `[produccionId]`.

### Enum `EstadoProduccion`

```
ACTIVA
ANULADA
```

---

## 2. Flujos de UI

### 2.1 Vista global — nueva sección sidebar "Producciones"

**Ruta:** `/producciones`  
**Icono sidebar:** Factory (Lucide)

**Cards de resumen (arriba):**
- Producciones hoy (count).
- Unidades hoy (suma).
- Costo materia prima hoy (suma costoTotalProduccion).
- Selector de rango: hoy / esta semana / este mes.

**Listado:**
- Columnas: Fecha, Receta (enlace a `/recetas/[id]`), Unidades, Costo MP, Estado (badge).
- Orden: fecha descendente.
- Acciones por fila: Editar, Anular.
- Filtros opcionales: por receta, por estado, por rango de fechas.

**Acciones:**
- **Anular:** Modal confirmación → estado ANULADA, movimientos ENTRADA inversos, restaura stock. Fila con badge rojo.
- **Editar:** Modal con campo unidades → anula anterior + crea nueva con misma fecha original.

### 2.2 Historial en detalle de receta

En `RecetaDetalleModule`, debajo de "Registrar producción":

- Título: "Historial de producción".
- Lista compacta de últimas 10 producciones de esta receta.
- Cada item: fecha corta, unidades, costo MP, badge estado.
- Acciones: Editar, Anular.
- Sin producciones: "Aún no se ha registrado producción para esta receta."
- Si hay más de 10: enlace "Ver todas en Producciones" → `/producciones?recetaId=<id>`.

### 2.3 Conexión entre vistas

- Detalle receta → "Ver todas en Producciones" → vista global filtrada.
- Vista global → clic en receta → detalle de esa receta.
- Bidireccional.

### 2.4 Flujo post-registro

- Al producir, el historial se refresca automáticamente (loadData ya existente).

---

## 3. Manejo de errores

- **Anular ya anulada:** backend rechaza 400. Front deshabilita botón si estado ANULADA.
- **Editar anulada:** no permitido, botón deshabilitado.
- **Stock negativo al anular:** se permite, con advertencia en modal.
- **Receta eliminada:** producción sigue visible (tiene recetaNombre snapshot). Enlace a receta muestra 404.
- **Concurrencia:** transacción Prisma protege consistencia.

---

## 4. Endpoints API

| Método | Ruta                            | Descripción                                                |
|--------|---------------------------------|------------------------------------------------------------|
| GET    | `/api/producciones`             | Listado global. Query: `recetaId`, `estado`, `desde`, `hasta` |
| GET    | `/api/producciones/resumen`     | Métricas (count, unidades, costo) para rango de fechas     |
| POST   | `/api/recetas/[id]/producir`    | (Modificar) Crea registro Produccion + movimientos         |
| POST   | `/api/producciones/[id]/anular` | Cambia estado ANULADA, crea ENTRADA inversos               |
| POST   | `/api/producciones/[id]/editar` | Anula anterior, crea nueva con unidades corregidas         |

---

## 5. Pasos de implementación

1. **Migración Prisma:** modelo `Produccion`, enum `EstadoProduccion`, campo `produccionId` en `MovimientoInventario`.
2. **Refactorizar `registrarProduccionReceta`:** crear `Produccion` y vincular movimientos con `produccionId`.
3. **Endpoints:** GET producciones, GET resumen, POST anular, POST editar.
4. **Sidebar:** agregar "Producciones" en navegación.
5. **Vista global:** cards de resumen + listado con acciones (anular/editar).
6. **Detalle de receta:** sección historial (últimas 10 + enlace a vista global filtrada).
7. **Testing manual** de flujo completo: registrar → ver historial → editar → anular → verificar stock.
