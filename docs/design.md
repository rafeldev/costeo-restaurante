# Guía de diseño — CalculaChef (Costeo Restaurante)

Guía de los estilos **tal como están hoy en el código**. Su fuente de verdad es `app/globals.css` y `components/ui/`. Complementa a `.interface-design/system.md` (dirección y heurísticas); este documento es la referencia práctica de tokens, clases y patrones.

> Regla general: usar los tokens y componentes existentes antes de escribir clases nuevas. Los colores se referencian con `var(--token)`, no con valores hex.

---

## 1. Identidad

- **Sensación:** cálida, clara y de herramienta de trabajo. Evoca cocina sin ser decorativa.
- **Firma visual:** fondo "pergamino", texto "tinta", acento terracota; tarjetas tipo ficha; pestañas con borde inferior.
- **Idioma:** toda la UI en español (`<html lang="es">`). Usar "Contraseña", "Configuración", etc., con tildes.
- **Tema:** solo claro. No hay modo oscuro (no existe `dark:` en el código).

## 2. Tokens de color (`app/globals.css`)

### Superficies
| Token | Valor | Uso |
|---|---|---|
| `--parchment` | `#faf9f6` | Fondo de página, fondos secundarios, EmptyState |
| `--paper` | `#ffffff` | Tarjetas, navegación, superficies elevadas |
| `--paper-elevated` | `#ffffff` | Reservado (hoy igual a `--paper`) |
| `--control-bg` | `#f1f5f9` | Fondo de inputs (efecto "hundido"), hover de botón secundario |

### Texto
| Token | Valor | Clase utilitaria | Uso |
|---|---|---|---|
| `--ink` | `#0f172a` | `.text-primary` | Texto principal, títulos |
| `--ink-secondary` | `#475569` | `.text-secondary` | Descripciones, texto de apoyo |
| `--ink-tertiary` | `#64748b` | `.text-tertiary` | Texto terciario |
| `--ink-muted` | `#94a3b8` | `.text-muted` | Placeholders, hints, deshabilitado |

### Bordes (baja opacidad para que no dominen)
| Token | Valor | Uso |
|---|---|---|
| `--border-subtle` | `#e2e8f0` | Separadores suaves, hover de ítems de nav |
| `--border` | `#e2e8f0` | Borde estándar de cards y filas |
| `--border-strong` | `#cbd5e1` | Énfasis, ErrorState, hover de botón secundario
| `--border-input` | `#cbd5e1` | Borde de inputs (`--control-border`) |
| `--border-focus` | `rgba(194,94,25,.5)` | Focus (definido; los inputs usan `--control-focus`) |

### Acento y estados
| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#c25e19` | Tab activa, spinner, focus de input |
| `--accent-hover` | `#9a3412` | Hover del acento |
| `--ring` | `rgba(194,94,25,.2)` | Anillo de focus (3px) |
| `--danger-bg` (= `--danger-surface`) / `--danger-text` / `--danger-border` / `--danger-hover` | `#fef2f2` / `#b91c1c` / `#fecaca` / `#fee2e2` | Errores y acciones destructivas |
| `--success-text` / `--success-surface` | `#15803d` / `#f0fdf4` | Rentable, stock sano; **aún sin uso** |
| `--warning-text` / `--warning-surface` | `#b45309` / `#fffbeb` | Ajustar, reorden; **aún sin uso** |
| `--info-text` / `--info-surface` / `--info-border` | `#0369a1` / `#f0f9ff` / `#bae6fd` | Callouts educativos; **aún sin uso** |
| `--shadow-card` / `--shadow-popover` / `--shadow-modal` | ver `globals.css` | Niveles de elevación 1, 2 y 3 |

### Alias heredados (migración gradual)
`--background`, `--surface`, `--foreground`, `--muted-foreground` apuntan a los tokens anteriores. En Tailwind están expuestos vía `@theme inline` como `bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-border`, `border-border-subtle`, `border-border-strong`, `text-accent`. **Preferir los tokens nuevos** (`var(--…)` y las clases `.text-*`).

### Colores de Tailwind directos (semáforos y badges)
Los estados no usan tokens, sino paletas de Tailwind:

| Estado | Clases |
|---|---|
| Verde / activa / ok | `bg-emerald-100 text-emerald-800` |
| Amarillo / ajustar | `bg-amber-100 text-amber-800` |
| Rojo / anulada / riesgo | `bg-red-100 text-red-800` |
| Sin dato (`sin_precio`) | `bg-[var(--control-bg)] text-secondary` |

## 3. Tipografía

- **Familia:** `Inter`, `Segoe UI`, Arial, Helvetica, sans-serif (`--font-sans`). Inter se carga con `next/font/google` en `app/layout.tsx` (variable `--font-inter`). Mono: Menlo/Monaco/Consolas.
- `<body class="antialiased">`.

| Elemento | Clases |
|---|---|
| Título de página (`h1`) | `text-xl font-bold tracking-tight text-primary sm:text-2xl` |
| Título de login (`h1`) | `text-2xl font-semibold tracking-tight text-primary sm:text-3xl` |
| Título de card (`h2`) | `text-base font-semibold text-primary sm:text-lg` |
| Título de modal | `text-lg font-semibold text-primary` |
| Descripción de página | `mt-2 max-w-3xl text-sm text-secondary` |
| Descripción de card | `mt-1 text-sm text-secondary` |
| Label de campo | `mb-1.5 block text-sm font-medium text-primary` |
| Hint | `mt-1 text-xs text-muted` |
| Error de campo | `mt-1 text-xs font-medium text-[var(--danger-text)]` |
| Texto base de controles | `1rem` en `.input`; `0.875rem` y peso 600 en botones |

## 4. Espaciado, radios y elevación

- **Escala:** múltiplos de 4px (Tailwind).
- **Contenedor de página:** `mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8`.
- **Header de página:** `mb-6 sm:mb-8`. **Nav:** `mb-6 sm:mb-8`.
- **Cards:** `p-4 sm:p-5`. **Modal / login:** `p-5 sm:p-6` / `p-6 sm:p-8`.
- **Entre bloques:** `gap-4`; en layouts de dos columnas `lg:gap-6`.
- **Formularios:** `space-y-3.5` o `space-y-4`.

| Elemento | Radio |
|---|---|
| Card (`.surface-card`) | `0.75rem` |
| Input y botón | `0.5rem` |
| Nav, EmptyState, ErrorState | `rounded-xl` |
| Fila de lista, ítem de nav | `rounded-lg` |
| Badge, chip, spinner | `rounded-full` |

**Elevación:** un solo nivel. Borde `--border` + sombra `--shadow-card` (`.surface-card`). El modal añade `shadow-lg`; la nav, `shadow-sm`. No combinar sombra con bordes fuertes.

## 5. Componentes (`components/ui/`)

### Button
`<Button variant isLoading loadingLabel>`; las variantes mapean a clases globales:

| Variante | Clase | Aspecto |
|---|---|---|
| `primary` (por defecto) | `.btn-primary` | Fondo `--ink`, texto blanco; hover `#1e293b`. Nueva variante `.btn-accent`: fondo `--accent`, hover `--accent-hover` |
| `secondary` | `.btn-secondary` | Fondo `--parchment`, borde `--border`; hover `--control-bg` |
| `danger` | `.btn-danger` | Fondo `--danger-bg`, texto `--danger-text`, borde rojo 30% |
| `ghost` | `.btn-ghost` | Transparente; hover `--border-subtle` |

- Alto mínimo `2.75rem` (44 px, tamaño táctil). Disabled: `opacity .6` + `cursor-not-allowed`.
- Focus visible: anillo `0 0 0 3px var(--ring)` (rojo 20% en `danger`).
- `isLoading` muestra spinner + `loadingLabel` (por defecto "Guardando…") y pone `aria-busy`.
- Variante compacta (usada en nav y ErrorState): `btn-secondary min-h-9 px-4 text-sm`.
- Enlaces con aspecto de botón: `className="btn-primary inline-flex items-center"` sobre `<Link>`.
- El botón primario es **oscuro (tinta), no ámbar**; la terracota queda para focus, tabs, spinner y `.btn-accent`.

### Card / CardHeader
`<Card>` renderiza `<article class="surface-card p-4 sm:p-5">`. `<CardHeader title description>` aporta el `h2` y la descripción.

### Input y Field
- `.input`: ancho completo, alto mín. `2.75rem`, fondo `--control-bg`, borde `--control-border`, padding `0.625rem 0.75rem`. Focus: borde `--accent` + anillo `--ring`. Disabled: `opacity .7`.
- `<Field label hint error>` conecta label, `aria-describedby` y `aria-invalid` con el input hijo (solo si es elemento nativo).

### Tabs
`<Tabs items value onChange aria-label>` con `role="tablist"`, navegación por flechas/Home/End. Activa: `border-b-2 border-[var(--accent)] text-[var(--ink)]`; inactiva: borde transparente y texto secundario. Contenedor: `mb-4 border-b border-[var(--border)]`.

### Estados de pantalla
| Componente | Uso | Aspecto |
|---|---|---|
| `LoadingState` | Carga de lista/página | Spinner 32 px (borde `--border`, tope `--accent`) + texto; `role="status"` |
| `EmptyState` | Sin datos | Caja `--parchment` con borde sutil, título `text-sm font-medium`, acción opcional |
| `ErrorState` | Fallo de carga | Fondo `--danger-bg`, borde `--border-strong`, texto `--danger-text`, botón "Reintentar"; `role="alert"` |

### ConfirmModal
Overlay `bg-[var(--ink)]/40` (clic cierra, Escape cierra), tarjeta `surface-card max-w-md`. Botones alineados a la derecha: "Cancelar" (`btn-secondary`) y confirmar (`btn-primary` o `btn-danger` con `variant="danger"`). Admite `children` para detalle (p. ej. el nombre del elemento).

### Toasts
`sonner`, posición `top-right`, `richColors`, `closeButton`, 3600 ms, `text-sm`. Configurado en `app/providers.tsx`.

## 6. Layout y navegación

- **`PageContainer`** (título + descripción + contenido) envuelve cada página e incluye `MainNav`.
- **`MainNav`:** barra en `--paper` con borde y `shadow-sm`, ítems `min-h-11 rounded-lg px-3 text-sm font-medium`. Activo: `bg-[var(--ink)] text-white`; inactivo: `text-secondary` con hover `--border-subtle`. Scroll horizontal oculto en móvil. A la derecha: nombre de sesión y botón "Cerrar sesión".
- **Mobile first:** una columna por defecto, columnas a partir de `sm`/`md`/`lg`/`xl`.

### Layouts recurrentes
| Patrón | Clases | Dónde |
|---|---|---|
| Formulario + lista | `grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:gap-6` (`xl:` en compras e inventario, `400px` en recetas) | Insumos, Compras, Inventario, Recetas |
| Cards de módulo | `grid grid-cols-1 gap-4 md:grid-cols-3` | Inicio |
| Métricas | `grid grid-cols-1 gap-3 sm:grid-cols-3` | Producciones |
| Fila de lista | `grid grid-cols-1 gap-2 rounded-lg border border-[var(--border)] p-3 md:grid-cols-[1fr_auto] md:items-center` | Insumos, Recetas, Producciones, Inventario |
| Fila de ingrediente | `grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]` | Formularios de receta |

No se usan tablas HTML: las listas son filas de `grid` con borde.

## 7. Patrones de UI

- **Badges de estado:** `rounded-full px-2 py-0.5 text-xs font-medium` + par de colores de la sección 2. Valores: semáforo de rentabilidad ("Rentable", "Ajustar", "Riesgo", "Sin precio"), reposición (verde/amarillo/rojo) y producción (ACTIVA/ANULADA).
- **Fila anulada:** `border-[var(--danger-border)] bg-red-50/40 opacity-75`.
- **Chip de marca (login):** `inline-flex rounded-full border border-[var(--border)] bg-[var(--parchment)] px-3 py-1 text-xs font-medium tracking-wide text-secondary`.
- **Login:** tarjeta centrada `max-w-md`, degradado superior `from-[var(--border-subtle)] to-transparent`.
- **Eliminar / producir / anular:** siempre con `ConfirmModal`.
- **Carga:** `LoadingState` al cargar listas; `isLoading` en botones al enviar.
- **Errores de formulario:** mensaje bajo el campo (`Field error`); errores de API en toast.

## 8. Accesibilidad

- Tamaño táctil mínimo de 44 px (`min-h-11`) en botones, tabs y nav; 36 px (`min-h-9`) solo en acciones secundarias compactas.
- Focus visible con anillo en botones e inputs; nunca quitar el outline sin reemplazo.
- Roles ARIA ya aplicados: `tablist/tab/tabpanel`, `dialog` + `aria-modal`, `status`, `alert`, `aria-current="page"`, `aria-busy`.
- El color nunca es la única señal: los badges llevan texto.

## 9. Inconsistencias conocidas

Cosas que **no coinciden** con la guía y conviene corregir al tocar esas zonas:

1. ~~`--danger-border` sin definir~~ y ~~Inter sin cargar~~: resueltos en la migración a Stitch.
3. **Colores de estado sin tokens:** los badges usan `emerald/amber/red` de Tailwind mientras que `--success-text` y `--warning-text` están sin usar. Migrar a `--success-surface`, `--warning-surface`, etc. (ya definidos).
4. **Tokens duplicados o sin uso:** `--paper-elevated`, `--border-focus`, `--accent-hover`, `--ink-tertiary` y los alias heredados.
5. **Estilos repetidos a mano:** los badges y las filas de lista se copian en cada módulo; candidatos a componentes `Badge` y `ListRow` en `components/ui/`.
6. **Hover del botón primario codificado** (`#1e293b`) en vez de un token.
7. **Sin modo oscuro** ni soporte de `prefers-color-scheme`.

## 10. Cómo añadir UI nueva

1. Reutilizar `PageContainer`, `Card`, `Field`, `Input`, `Button`, `Tabs` y los estados de `components/ui/`.
2. Colores solo con tokens (`var(--…)` o `.text-*`); para estados, las parejas `*-100 / *-800` de la sección 2.
3. Mobile first, objetivos táctiles de 44 px y etiquetas en español.
4. Si algo se repite en una tercera pantalla, extraerlo a `components/ui/`.
5. Si cambia un token o patrón, actualizar este documento y `.interface-design/system.md`.
