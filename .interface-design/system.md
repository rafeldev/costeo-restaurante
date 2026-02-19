# Sistema de diseño — Costeo Restaurante

Documentación de la dirección visual y patrones reutilizables para mantener consistencia en la UI.

## Dirección y sensación

- **Producto:** MVP de costeo para restaurantes (insumos, recetas, inventario, configuración).
- **Sensación:** Cálida y clara; evoca cocina/restaurante sin ser decorativa. Interfaz de trabajo confiable.
- **Firma:** Paleta cálida (parchment, ink, accent ámbar/terracota); cards que funcionan como “fichas” de receta o insumo; tabs con estilo pestaña, no botones.

## Paleta (tokens CSS)

Definidos en `app/globals.css`:

| Token | Uso |
|-------|-----|
| `--parchment` | Fondo de página y zonas secundarias |
| `--paper` | Superficie de tarjetas y contenido elevado |
| `--ink` | Texto principal |
| `--ink-secondary` | Texto secundario / descripciones |
| `--ink-tertiary` | Texto terciario |
| `--ink-muted` | Placeholder, hints, deshabilitado |
| `--border`, `--border-subtle`, `--border-strong` | Bordes por intensidad |
| `--accent` | Acción principal, focus, tabs activos |
| `--ring` | Anillo de focus (sutil) |
| `--control-bg` | Fondo de inputs (inset) |
| `--danger-bg`, `--danger-text` | Errores y acciones destructivas |

## Estrategia de profundidad

- **Bordes:** Una sola escala (subtle, standard, strong, focus). Opacidad baja para que no dominen (squint test).
- **Sombras:** Muy suaves en cards (`0 1px 2px`); no mezclar con bordes fuertes.
- **Navegación:** Mismo tono de fondo que el contenido; separación por borde, no por color distinto.

## Espaciado

- Base implícita: múltiplos de 4px (Tailwind).
- Cards: `p-4 sm:p-5`.
- Entre secciones: `gap-4` o `mb-6 sm:mb-8` en headers.
- Formularios: `space-y-3.5` o `space-y-4`.

## Componentes base

- **Button:** Variantes `primary`, `secondary`, `danger`, `ghost`. Prop `isLoading` con `loadingLabel` (p. ej. "Guardando…", "Ingresando…").
- **Card / CardHeader:** Superficie `surface-card`; título con `text-primary`, descripción `text-secondary`.
- **Tabs:** Componente accesible (role tablist, aria-selected, teclado); estilo pestaña con borde inferior para activo.
- **Field:** Label + children; inyecta `id`, `aria-describedby`, `aria-invalid` cuando el hijo es un input nativo.
- **Input:** Clase `.input` (control-bg, control-border, focus ring).
- **LoadingState, EmptyState, ErrorState:** Estados de lista/página con spinner, mensaje y opcional acción "Reintentar".
- **ConfirmModal:** Diálogo de confirmación con Cancelar / Confirmar; variante `danger` para eliminar.

## Patrones por pantalla

- **Login:** Labels con `text-primary`; error con `role="alert"` y `aria-live="polite"`; botón con estado de carga.
- **Inicio:** Cards de módulo con CardHeader + CTA "Ir al módulo".
- **Insumos:** Tabs (Insumos / Compras / Inventario); listado con LoadingState, EmptyState, ErrorState; eliminación con ConfirmModal.
- **Recetas:** Igual que insumos para listado; detalle con breadcrumb "Recetas / [Nombre]"; "Registrar producción" con ConfirmModal.
- **Configuración:** Formulario único; botón "Guardar configuración" con texto "Guardando…" durante submit.

## Heurísticas aplicadas

1. **Visibilidad del estado:** Loading con spinner o mensaje; botones con "Guardando…" / "Ingresando…"; toasts para éxito/error.
2. **Lenguaje del usuario:** "Contraseña" (no "Contrasena"); labels en español; mensajes de error en claro con sugerencia.
3. **Control y libertad:** ConfirmModal con Cancelar y Confirmar; salida clara en modales.
4. **Consistencia:** Mismos tokens y componentes en toda la app; tabs como pestañas.
5. **Prevención de errores:** Confirmación antes de "Producir" y antes de eliminar insumo/receta.
6. **Reconocimiento:** Breadcrumb en detalle de receta; opciones visibles en navegación.
7. **Errores recuperables:** Mensajes claros; ErrorState con "Reintentar" donde aplica.

## Archivos clave

- Tokens y estilos globales: `app/globals.css`
- Componentes UI: `components/ui/` (Button, Card, Tabs, Field, Input, LoadingState, EmptyState, ErrorState, ConfirmModal)
- Shell: `components/PageContainer.tsx`, `components/MainNav.tsx`
