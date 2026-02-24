# Diseño: Flujo insumos ↔ recetas (Enfoque 3)

**Fecha:** 2025-02-24  
**Objetivo:** Conectar las calculadoras de costo unitario (insumos) y de costeo (recetas) para que, al actualizar un insumo, quede claro el impacto en recetas y se pueda ir directo a revisar el costeo.

---

## 1. Objetivo y datos

**Objetivo**  
Conectar las dos calculadoras (costo unitario en insumos y costeo en recetas) para que, al actualizar un insumo, quede claro que impacta en recetas y se pueda ir directo a revisar el costeo (Enfoque 3).

**Datos necesarios**  
- Por insumo: cuántas recetas lo usan y, para enlazar, qué recetas son.
- En Prisma ya existe la relación: `Insumo.recetaInsumos` → `RecetaInsumo`. Con un `_count` de `recetaInsumos` por insumo alcanza para el “En N recetas” y para el mensaje post-guardado.
- Para “Ver recetas afectadas” hace falta saber qué recetas son: o bien devolver los IDs en la API de insumos (o en un endpoint tipo `GET /api/insumos/[id]/recetas`) o bien llevar el `insumoId` en la URL de recetas y filtrar en front (p. ej. `/recetas?insumoId=xxx`).

**Decisiones de arquitectura**  
- Incluir en `GET /api/insumos` un campo `recetasCount` (y opcionalmente `recetaIds`) usando `_count` y/o `include` de `recetaInsumos` con `recetaId`, para no añadir un endpoint nuevo si no hace falta.
- En el listado de insumos mostrar “En N recetas” con enlace a `/recetas?insumoId=<id>`.
- Tras guardar (crear/editar) un insumo, si `recetasCount > 0`, mostrar el mensaje con enlace a esa misma URL.

---

## 2. Flujos de UI

### 2.1 Listado de insumos (siempre visible)

- Cada fila del listado muestra, junto a la info actual (categoría, unidad, costo, merma, stock), una línea o chip: **“En N recetas”** (si N > 0).
- “En N recetas” es un **enlace** a `/recetas?insumoId=<idDelInsumo>`.
- Si N = 0, no se muestra nada (o texto neutro “No usado en recetas”), según se prefiera mantener la tabla ligera.
- No se añaden botones extra; el enlace va en la misma línea que el nombre o en la línea de detalle secundaria.

### 2.2 Después de guardar (crear o editar insumo)

- Al guardar con éxito, si ese insumo está en al menos una receta:
  - Mostrar un **toast** (o mensaje inline breve bajo el formulario): *“Guardado. Este insumo se usa en N recetas. [Ver recetas afectadas]”*.
  - “Ver recetas afectadas” es enlace a `/recetas?insumoId=<id>`.
- Si no está en ninguna receta, el feedback es el actual (solo “Guardado” / toast de éxito), sin mensaje de recetas.

### 2.3 Página de recetas con `?insumoId=`

- Cuando se entra a `/recetas?insumoId=xxx`, la lista de recetas se **filtra** para mostrar solo las que usan ese insumo.
- Opcional: aviso arriba “Mostrando recetas que usan [nombre del insumo]” con enlace para quitar el filtro.
- El costeo (semáforo, precio sugerido) ya está actualizado porque los datos vienen del servidor; no hace falta acción extra para “recalcular”.

---

## 3. Errores e implementación

### 3.1 Errores

- **API insumos con count:** Si falla la query, el GET de insumos se comporta como hoy; no exponer `recetasCount` hasta que esté estable. En el front, si el backend no envía `recetasCount`, no mostrar “En N recetas” ni el enlace (degradación elegante).
- **Filtro en recetas:** Si `insumoId` no existe o no es del usuario, el filtro devuelve lista vacía; no error fuerte, solo “No hay recetas que usen este insumo” o quitar el filtro y mostrar todas.
- **Post-guardado:** El mensaje “Ver recetas afectadas” solo se muestra cuando el guardado fue exitoso y hay al menos una receta; si no, solo toast de éxito.

### 3.2 Cambios concretos

- **Backend:** En `GET /api/insumos` incluir `_count: { recetaInsumos: true }` y devolver `recetasCount` en cada insumo. Opcional: endpoint `GET /api/insumos/[id]/recetas`; si no se añade, el filtro en recetas se hace en front con los datos de `/api/recetas` (filtrar por insumoId en ingredientes).
- **Front – InsumosModule:** (1) Tras crear/editar, si la respuesta tiene `recetasCount > 0`, mostrar toast con “Ver recetas afectadas” → `/recetas?insumoId=...`. (2) En el listado, para cada insumo con `recetasCount > 0`, mostrar el enlace “En N recetas” → `/recetas?insumoId=...`.
- **Front – Recetas:** Leer `insumoId` de la URL (searchParams); al cargar recetas, filtrar en cliente por ese insumo o que un endpoint acepte `?insumoId=` y filtre en servidor. Mostrar aviso “Mostrando recetas que usan [nombre]” cuando haya filtro y opción de quitar filtro.

### 3.3 Testing

- Unit: que el serializador de insumos incluya `recetasCount` cuando viene de Prisma.
- Manual: crear/editar insumo usado en 1+ recetas → ver toast y enlace; entrar por “En N recetas” y comprobar lista filtrada y costeo actual.
