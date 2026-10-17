# Plan: Recorrido de bienvenida (onboarding) con React Joyride

**Fecha:** 2026-10-13
**Origen:** análisis de librerías de product tour. Se eligió **React Joyride v3** (MIT, soporta React 16.8–19, apto para SSR, con foco atrapado, teclado y ARIA). Shepherd.js e Intro.js se descartaron porque su licencia AGPL exige pagar una comercial para un producto como este.

---

## Objetivo

La **primera vez** que un usuario entra a CalculaChef, un recorrido corto le explica el flujo mínimo para empezar a costear:

> Configuración de costeo → Insumos → Recetas (precio sugerido) → Producciones

El recorrido debe:

- Mostrarse una sola vez por usuario, **en cualquier dispositivo**, así que el estado se guarda en la base de datos y no en `localStorage`.
- Poder **omitirse** en cualquier paso y **volver a abrirse** a voluntad.
- Pasar por varias páginas del App Router sin romperse.
- Verse como el resto de la app: tokens de `globals.css`, primitivas de `components/ui/` y textos en español.
- Funcionar en móvil, donde la navegación principal está oculta (`hidden lg:flex`).

## Fuera de alcance

- Analítica de cuántos usuarios completan u omiten el recorrido. El evento queda preparado (ver Fase 3), pero no se envía a ningún servicio.
- Recorridos por módulo (por ejemplo, uno solo para Tomas de inventario). La arquitectura los permite, pero aquí solo se construye el de bienvenida.
- Datos de ejemplo para usuarios nuevos. El recorrido se adapta a estados vacíos y no crea registros.

---

## Decisiones

| # | Decisión | Elección | Motivo |
|---|----------|----------|--------|
| D1 | Dónde se guarda "ya lo vio" | Columnas en `User` | Multi-dispositivo y auditable. `localStorage` volvería a mostrarlo en cada navegador. |
| D2 | Versionado | `onboardingVersion Int` frente a la constante `ONBOARDING_VERSION` | Si el recorrido cambia de forma importante, se sube la constante y se vuelve a mostrar. |
| D3 | Usuarios existentes | La migración los marca con la versión actual y **no** lo ven automáticamente | Solo es "primera vez" para los usuarios nuevos. Pueden abrirlo desde "Ver recorrido". ⚠️ Confirmar con producto. |
| D4 | Modo de Joyride | Controlado (`stepIndex` + `onEvent`) | Es necesario para pausar, navegar con `router.push` y retomar en otra ruta. |
| D5 | Tooltip | Componente propio con `Button` y tokens | Mantiene el sistema visual (`.interface-design/system.md`). |
| D6 | Selectores | Atributos `data-tour="…"` | Estables frente a cambios de clases de Tailwind. |
| D7 | Largo | 8 pasos como máximo | Los recorridos largos se abandonan. Lo demás lo cubre la Guía de Costeo (`/glosario`). |

---

## Orden y dependencias

| Fase | Contenido | Riesgo | Depende de |
|------|-----------|--------|------------|
| 0. Spike de API v3 | Instalar y validar los nombres exactos de la API | Bajo | — |
| 1. Persistencia | Schema, migración, servicio y API `/api/onboarding` | Bajo (migración aditiva) | — |
| 2. Pasos y anclas | Definición tipada de pasos y `data-tour` en la UI | Bajo | 0 |
| 3. Motor del recorrido | Provider, navegación entre rutas y tooltip propio | Medio | 0, 2 |
| 4. Integración | Montaje, arranque automático, botón "Ver recorrido" y móvil | Medio | 1, 3 |
| 5. Checklist "Primeros pasos" (opcional) | Tarjeta en el dashboard con progreso real | Bajo | 1 |
| 6. Verificación | Lint, tipos, tests, build y QA manual | — | todas |

Cada fase va en un commit propio, con `npm run lint`, `npx tsc --noEmit` y `npm test` en verde.

---

## Fase 0: Spike de API v3

```bash
npm install react-joyride@^3.2.0
```

Hay que verificar contra https://react-joyride.com/docs antes de escribir código. La v3 renombró mucho respecto de la v2:

- [ ] `import { Joyride } from "react-joyride"` (exportación **nombrada**, ya no default).
- [ ] `callback` pasó a `onEvent(data, controls)`, con los tipos `EventHandler` / `EventData`.
- [ ] `disableBeacon` pasó a `skipBeacon`, y ahora va en `options`.
- [ ] `disableOverlayClose` pasó a `overlayClickAction: false | "close" | "next"`.
- [ ] `disableCloseOnEsc` pasó a `dismissKeyAction`.
- [ ] Los botones se definen con un arreglo `buttons: ("back" | "close" | "primary" | "skip")[]`.
- [ ] `scrollOffset`, `showProgress` y `spotlightPadding` viven en `options`.
- [ ] Locale: `nextWithProgress` con los marcadores `{current}` / `{total}`.
- [ ] `run` ahora vale `false` por defecto.
- [ ] **Por confirmar:** el nombre y la firma de la prop del tooltip propio (`tooltipComponent` en v2), y si `stepIndex` sigue siendo la forma del modo controlado o si se prefiere `useJoyride().controls`.
- [ ] **Por confirmar:** qué evento emite cuando no encuentra el `target` (en v2 era `EVENTS.TARGET_NOT_FOUND`).

**Entregable:** una nota corta al final de este documento ("Hallazgos del spike") con los nombres reales. Si algo difiere de este plan, se ajustan las fases 3 y 4 antes de seguir.

---

## Fase 1: Persistencia

### Schema (`prisma/schema.prisma`)

```prisma
model User {
  // …campos existentes
  onboardingVersion     Int       @default(0)
  onboardingCompletedAt DateTime?
  onboardingSkippedAt   DateTime?
}
```

- `onboardingVersion`: la última versión del recorrido que el usuario terminó u omitió.
- Se separan `completedAt` y `skippedAt` para poder medir después cuántos lo terminan y cuántos lo abandonan.

### Migración

```bash
npm run db:migrate -- --name add_user_onboarding
```

Al SQL generado se le agrega el backfill de la decisión D3:

```sql
UPDATE "User" SET "onboardingVersion" = 1 WHERE "createdAt" < NOW();
```

### Servicio (`lib/onboarding.ts`)

```ts
export const ONBOARDING_VERSION = 1;

export type OnboardingStatus = {
  shouldShow: boolean;
  version: number;
};

export type OnboardingOutcome = "completed" | "skipped";

export function shouldShowOnboarding(userVersion: number): boolean {
  return userVersion < ONBOARDING_VERSION;
}

export async function getOnboardingStatus(ownerId: string): Promise<OnboardingStatus>;
export async function markOnboarding(ownerId: string, outcome: OnboardingOutcome): Promise<void>;
```

- Todas las lecturas y escrituras van con `where: { id: ownerId }`, siguiendo el `AGENTS.md`.

### API (`app/api/onboarding/route.ts`)

- `export const runtime = "nodejs"`.
- `GET` devuelve `{ shouldShow, version }`.
- `PATCH` recibe `{ outcome: "completed" | "skipped" }`.
- Ambos llaman a `requireAuthUser()` y manejan errores con `handleRouteError()`. El test `lib/api-auth-guard.test.ts` ya hace cumplir lo primero.
- El schema Zod `onboardingOutcomeSchema` va en `lib/validation.ts`.

### Tests

- `lib/onboarding.test.ts`: `shouldShowOnboarding` con 0 → true, igual a la versión → false y mayor → false.
- `app/api/onboarding/route.test.ts`: 401 sin sesión, 400 con un `outcome` inválido y 200 en el caso feliz. Seguir el patrón de `app/api/dashboard/route.test.ts`.

---

## Fase 2: Pasos y anclas

### Definición de pasos (`lib/onboarding-steps.ts`)

Son datos puros, sin React, para poder probarlos:

```ts
export type TourRoute = "/" | "/configuracion" | "/insumos" | "/recetas" | "/producciones";

export type TourStepDefinition = {
  id: string;
  route: TourRoute;
  target: `[data-tour="${string}"]` | "body";
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  desktopOnly?: boolean;
};
```

### Recorrido propuesto (8 pasos)

| # | Ruta | `data-tour` | Mensaje (borrador) |
|---|------|-------------|--------------------|
| 1 | `/` | `body` (centrado) | **Bienvenido a CalculaChef.** En 2 minutos te mostramos cómo llegar al precio sugerido de tu primer plato. |
| 2 | `/` | `nav-principal` *(solo escritorio)* | Desde aquí te mueves entre Insumos, Recetas, Producciones y Configuración. |
| 3 | `/configuracion` | `config-parametros` | **Paso 1: define tus reglas.** Overhead, margen objetivo, impuesto y redondeo. Se aplican a todas tus recetas. |
| 4 | `/insumos` | `insumos-crear` | **Paso 2: registra tus insumos** con su unidad de compra, costo y merma. |
| 5 | `/insumos` | `insumos-importar` | ¿Ya los tienes en Excel? Impórtalos por CSV o desde una factura. |
| 6 | `/recetas` | `recetas-crear` | **Paso 3: arma la ficha técnica.** Ingredientes y porciones; el sistema calcula el costo y el precio sugerido. |
| 7 | `/producciones` | `producciones-historial` | **Paso 4: registra lo que produces.** Desde el detalle de cada receta, "Registrar producción" descuenta el inventario. Aquí ves el historial y puedes anular. |
| 8 | `/` | `guia-costeo` | ¿Dudas con algún término? La Guía de Costeo está siempre aquí. Puedes repetir este recorrido desde tu menú. |

Los textos finales los revisa producto. Se mantienen cortos, con una idea por paso.

### Anclas a agregar

| Archivo | Elemento | Atributo |
|---------|----------|----------|
| `components/MainNav.tsx` | `<nav aria-label="Navegación principal">` | `data-tour="nav-principal"` |
| `components/MainNav.tsx` | link "Guía de Costeo" (escritorio) | `data-tour="guia-costeo"` |
| `components/configuracion/ConfiguracionModule.tsx` | sección de parámetros financieros | `data-tour="config-parametros"` |
| `components/insumos/InsumosModule.tsx` | botón "Nuevo Insumo" (~L362) | `data-tour="insumos-crear"` |
| `components/insumos/InsumosModule.tsx` | botón "Importar CSV / Factura" (~L354) | `data-tour="insumos-importar"` |
| `components/recetas/RecetasModule.tsx` | botón "Nueva Receta Maestra" (~L326) | `data-tour="recetas-crear"` |
| `components/producciones/ProduccionesModule.tsx` | `<section>` "Historial" (~L241) | `data-tour="producciones-historial"` |

Importante: el ancla tiene que existir **también en estado vacío**. Para un usuario nuevo, los listados muestran `EmptyState`. Los botones de crear e importar están en el encabezado del módulo, fuera del listado, así que deberían renderizarse igual; hay que confirmarlo en QA. La sección "Historial" de Producciones también existe vacía.

Nota: la producción **no** se registra en `/producciones`, sino desde `RecetaDetalleModule` ("Registrar producción"). Un usuario nuevo no tiene recetas, así que el recorrido no entra al detalle; el paso 7 lo explica desde el historial.

### Tests (`lib/onboarding-steps.test.ts`)

- Los `id` son únicos.
- Cada `route` pertenece a `TourRoute`.
- El primer y el último paso no son `desktopOnly`, porque deben existir siempre.
- Hay como máximo 8 pasos.
- (Opcional) Un test que busca cada `data-tour` de los pasos en `components/**` con `fs` y falla si un ancla desaparece por un refactor, al estilo de `api-auth-guard.test.ts`.

---

## Fase 3: Motor del recorrido

### Archivos

```
components/onboarding/
  OnboardingTourProvider.tsx   // "use client": contexto + <Joyride> controlado
  TourTooltip.tsx              // tooltip propio con tokens y Button
  useOnboardingTour.ts         // hook público: { start, isRunning }
lib/onboarding-dom.ts          // waitForElement(selector, timeoutMs)
```

### Estado del provider

```ts
type TourState = {
  run: boolean;
  stepIndex: number;
  phase: "idle" | "running" | "navigating";
};
```

### Navegación entre rutas (núcleo del plan)

1. `onEvent` recibe "siguiente" o "atrás" y calcula `nextIndex`.
2. Si `steps[nextIndex].route !== pathname`, pone `run = false` y `phase = "navigating"`, y llama a `router.push(route)`.
3. Un `useEffect` sobre `pathname` detecta que llegó a la ruta del paso y ejecuta `await waitForElement(target, 5000)`.
   - Esto hace falta porque los módulos cargan datos con `fetch` y muestran `LoadingState` primero. Sin la espera, Joyride no encuentra el ancla.
4. Si encuentra el elemento, pone `stepIndex = nextIndex`, `run = true` y `phase = "running"`.
5. Si se agota el tiempo, salta el paso y registra un `console.warn` en desarrollo. Nunca deja al usuario atascado.

`waitForElement` usa un `MutationObserver` sobre `document.body` y se desconecta en el cleanup.

### Fin y omisión

- Al terminar: `PATCH /api/onboarding { outcome: "completed" }` y un toast de Sonner: *"¡Listo! Empieza por configurar tus parámetros de costeo."*
- Al omitir, cerrar o pulsar Esc: `PATCH { outcome: "skipped" }` sin toast.
- La escritura es optimista: si el PATCH falla, se registra en consola y no se le vuelve a mostrar el recorrido en esta sesión.

### Recarga a mitad del recorrido

- `stepIndex` se guarda en `sessionStorage` (`calculachef:tour-step`), con lectura y escritura dentro de `try/catch`. Si el usuario recarga, el recorrido sigue desde ese paso. Se limpia al terminar u omitir.

### Configuración de Joyride (validar nombres en la Fase 0)

```tsx
<Joyride
  run={state.run}
  stepIndex={state.stepIndex}
  steps={joyrideSteps}
  continuous
  onEvent={handleEvent}
  tooltipComponent={TourTooltip}      // confirmar nombre en v3
  locale={{
    back: "Atrás",
    close: "Cerrar",
    last: "Finalizar",
    next: "Siguiente",
    nextWithProgress: "Siguiente ({current} de {total})",
    skip: "Omitir recorrido",
  }}
  options={{
    skipBeacon: true,
    showProgress: true,
    scrollOffset: 112,                 // header fijo de 80px + aire
    spotlightPadding: 8,
    zIndex: 60,                        // MainNav usa z-50
    primaryColor: "var(--accent)",     // verificar si acepta CSS vars; si no, #c25e19
  }}
  overlayClickAction={false}
  dismissKeyAction="close"
/>
```

### Tooltip propio (`TourTooltip.tsx`)

- Tarjeta `bg-[var(--paper)]` con `shadow-[var(--shadow-modal)]` y `rounded-xl`.
- Título con `text-sm font-semibold`, cuerpo con `text-sm leading-6 text-secondary`.
- Botones: `Button variant="ghost"` para "Omitir", `variant="secondary"` para "Atrás" y `variant="primary"` para "Siguiente" / "Finalizar".
- Indicador de progreso "3 de 8" con `tabular-nums`.
- Respeta `prefers-reduced-motion`: sin transición del tooltip.
- Ancho `max-w-[min(360px,calc(100vw-32px))]` para móvil.

### Evento para analítica futura

`handleEvent` emite `onboarding:step`, `onboarding:completed` y `onboarding:skipped` con el `id` del paso. Por ahora solo es un `CustomEvent` en `window`, sin destino.

---

## Fase 4: Integración

### Montaje

- `OnboardingTourProvider` se monta en `app/providers.tsx`, dentro de `SessionProvider`.
- El provider **no hace nada** si:
  - `useSession().status !== "authenticated"`, o
  - `pathname === "/login"`.

### Arranque automático

- Con la sesión autenticada y en `/`: `GET /api/onboarding`. Si `shouldShow`, se inicia el recorrido.
- Solo se arranca desde el dashboard. Si el primer login aterriza en otra ruta (por un `callbackUrl`), se espera a que el usuario visite `/`.
- Se usa un `ref` para que la consulta no se repita en cada render ni en el doble montaje de StrictMode.

### Volver a abrirlo

- `MainNav.tsx`: un botón "Ver recorrido" (icono `tour` de Material Symbols) junto al email en escritorio, y una entrada en el menú móvil.
- `GlosarioModule.tsx`: un enlace "Repetir el recorrido de bienvenida".
- Ambos llaman a `useOnboardingTour().start()`, que navega a `/` si hace falta y arranca en el paso 0. No toca la base de datos hasta terminar u omitir.

### Móvil (< `lg`)

- Los pasos con `desktopOnly: true` se filtran con `window.matchMedia("(min-width: 1024px)")` **al iniciar** el recorrido, no en cada paso, para no cambiar el total a mitad de camino.
- En el paso 8, el link "Guía de Costeo" tiene `hidden sm:inline-flex`, así que en pantallas menores a `sm` hay que usar un paso centrado (`target: "body"`) con el mismo texto. Se resuelve con un `mobileTarget?: "body"` en `TourStepDefinition`.

---

## Fase 5 (opcional): Checklist "Primeros pasos"

Complementa el recorrido con progreso real. Hace que el usuario *haga* las cosas y no solo las vea.

- `GET /api/dashboard` agrega `primerosPasos: { configuracion: boolean; insumos: number; recetas: number; producciones: number }`, con conteos filtrados por `ownerId`.
- `components/dashboard/PrimerosPasosCard.tsx` muestra 4 ítems con check, enlace a cada módulo y una barra de progreso.
- Se oculta sola cuando todo está completo. También se puede cerrar, y ese estado se guarda en `User.onboardingChecklistDismissedAt`.
- "Configuración" se da por hecha cuando existe una `ConfiguracionCosteo` del usuario que no es la del seed. ⚠️ Definir el criterio con producto.

---

## Fase 6: Verificación

### Automática

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

### QA manual

- [ ] Un usuario nuevo (`npm run user:create -- --email=nuevo@test.com --password=secreto123`) ve el recorrido al entrar.
- [ ] Recorrido completo en escritorio: los 8 pasos, la navegación entre rutas, el scroll correcto bajo el header fijo y el toast final.
- [ ] Al recargar en el paso 5, el recorrido sigue en el paso 5.
- [ ] "Omitir" en el paso 2 hace que no se vuelva a mostrar al cerrar y abrir sesión.
- [ ] Desde otro navegador con el mismo usuario, no se muestra.
- [ ] "Ver recorrido" desde Insumos navega a `/` y arranca.
- [ ] En móvil (375px) no hay pasos del nav, el tooltip no se desborda y los botones tienen al menos 44px.
- [ ] Con teclado: Tab dentro del tooltip, Enter avanza y Esc cierra.
- [ ] Con `prefers-reduced-motion` activo no hay animaciones.
- [ ] Un usuario existente (por el backfill) no lo ve automáticamente.
- [ ] En estados vacíos (usuario sin insumos ni recetas), todos los anclas existen.
- [ ] No hay errores de hidratación en la consola.

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| La API v3 difiere de lo descrito aquí | Fase 0 obligatoria antes de escribir el motor. |
| Un ancla no existe en estado vacío o de carga | `waitForElement` con timeout y salto del paso, más el test de anclas de la Fase 2. |
| Un refactor de UI borra un `data-tour` | Test que busca los anclas en `components/**`. |
| El overlay queda bajo `MainNav` (`z-50`) | `zIndex: 60` en `options`. |
| El recorrido molesta a usuarios existentes | Backfill de la decisión D3. |
| Doble arranque por StrictMode | `ref` de "ya consultado" en el provider. |

---

## Hallazgos del spike

- Se instaló y validó `react-joyride@3.2.0`.
- La exportación es nombrada: `import { Joyride } from "react-joyride"`.
- El modo controlado conserva `stepIndex`; `run` es `false` por defecto.
- El callback es `onEvent(data, controls)` y los tipos públicos son `EventHandler` y `EventData`.
- El tooltip propio conserva la prop `tooltipComponent` y recibe `TooltipRenderProps`.
- El target ausente emite `EVENTS.TARGET_NOT_FOUND` (`error:target_not_found`).
- `skipBeacon`, `showProgress`, `scrollOffset`, `spotlightPadding`, `targetWaitTimeout`, `buttons`, `overlayClickAction`, `dismissKeyAction` y `zIndex` pertenecen a `options`.
- `nextWithProgress` usa `{current}` y `{total}`.
- En modo continuo, `dismissKeyAction: "close"` emite `ACTIONS.CLOSE`; el provider debe interpretarlo como omisión para que Esc no avance al siguiente paso.
