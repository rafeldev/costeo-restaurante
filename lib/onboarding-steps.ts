export type TourRoute = "/" | "/configuracion" | "/insumos" | "/recetas" | "/producciones";

export const ONBOARDING_TOUR_VERSION = 1;

export type TourTarget = `[data-tour="${string}"]` | "body";

export type TourStepDefinition = {
  id: string;
  route: TourRoute;
  target: TourTarget;
  mobileTarget?: TourTarget;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  desktopOnly?: boolean;
};

export const ONBOARDING_STEPS: readonly TourStepDefinition[] = [
  {
    id: "bienvenida",
    route: "/",
    target: "body",
    title: "Bienvenido a CalculaChef",
    content: "En 2 minutos te mostramos cómo llegar al precio sugerido de tu primer plato.",
    placement: "center",
  },
  {
    id: "navegacion",
    route: "/",
    target: '[data-tour="nav-principal"]',
    title: "Tu navegación principal",
    content: "Desde aquí te mueves entre Insumos, Recetas, Producciones y Configuración.",
    placement: "bottom",
    desktopOnly: true,
  },
  {
    id: "configuracion",
    route: "/configuracion",
    target: '[data-tour="config-parametros"]',
    title: "Paso 1: define tus reglas",
    content: "Overhead, margen objetivo, impuesto y redondeo se aplican a todas tus recetas.",
    placement: "right",
  },
  {
    id: "crear-insumo",
    route: "/insumos",
    target: '[data-tour="insumos-crear"]',
    title: "Paso 2: registra tus insumos",
    content: "Define su unidad de compra, costo y merma para calcular el costo neto real.",
    placement: "bottom",
  },
  {
    id: "importar-insumos",
    route: "/insumos",
    target: '[data-tour="insumos-importar"]',
    title: "Importa lo que ya tienes",
    content: "Si tus insumos están en Excel o en una factura, puedes cargarlos sin empezar de cero.",
    placement: "bottom",
  },
  {
    id: "crear-receta",
    route: "/recetas",
    target: '[data-tour="recetas-crear"]',
    title: "Paso 3: arma la ficha técnica",
    content: "Agrega ingredientes y porciones; el sistema calcula el costo y el precio sugerido.",
    placement: "bottom",
  },
  {
    id: "producciones",
    route: "/producciones",
    target: '[data-tour="producciones-historial"]',
    title: "Paso 4: registra lo que produces",
    content: "Desde cada receta puedes descontar inventario. Aquí consultas el historial y puedes anular movimientos.",
    placement: "top",
  },
  {
    id: "guia-costeo",
    route: "/",
    target: '[data-tour="guia-costeo"]',
    title: "La guía siempre está disponible",
    content: "Consulta cualquier término en la Guía de Costeo y repite este recorrido cuando lo necesites.",
    placement: "bottom",
  },
] as const;
