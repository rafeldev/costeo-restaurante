export const CATEGORIAS_GLOSARIO = [
  "Costeo y Escandallo",
  "Inventario y Mermas",
  "Ingeniería de Menú",
  "Métricas Financieras",
  "Tributación y Precios",
] as const;

export type CategoriaGlosario = (typeof CATEGORIAS_GLOSARIO)[number];
export type FiltroCategoriaGlosario = CategoriaGlosario | "Todos";

export type TerminoGlosario = {
  id: string;
  nombre: string;
  aliases: readonly string[];
  categoria: CategoriaGlosario;
  indicador: string;
  definicion: string;
  formulaTitulo: string;
  formula: string;
  recomendacion: string;
  aplicacion: string;
};

export const TERMINOS_GLOSARIO: readonly TerminoGlosario[] = [
  {
    id: "food-cost",
    nombre: "Food Cost (% de costo de materia prima)",
    aliases: ["costo de alimentos", "porcentaje de costo"],
    categoria: "Costeo y Escandallo",
    indicador: "Rango orientativo: 28–35%",
    definicion:
      "Porcentaje del precio de venta neto que corresponde al costo directo de los ingredientes de una porción.",
    formulaTitulo: "Fórmula estándar",
    formula: "% Food Cost = (Costo de ingredientes / PVP neto) × 100",
    recomendacion:
      "Actualiza los costos de compra antes de revisar el indicador. Un precio de insumo desactualizado oculta la variación real.",
    aplicacion: "Seguimiento de rentabilidad por receta",
  },
  {
    id: "merma-yield",
    nombre: "Factor de merma y rendimiento (% Yield)",
    aliases: ["AP", "EP", "as purchased", "edible portion", "rendimiento"],
    categoria: "Inventario y Mermas",
    indicador: "Se mide por insumo y proceso",
    definicion:
      "Relación entre la cantidad comprada (AP) y la porción aprovechable (EP) después de limpiar, cortar o cocinar.",
    formulaTitulo: "Costo real ajustado",
    formula: "Costo EP = Costo AP / (1 − % Merma)",
    recomendacion:
      "Realiza pruebas de rendimiento por lote y registra el resultado. La merma cambia según el producto, proveedor y técnica.",
    aplicacion: "Compras, recepción y preparación",
  },
  {
    id: "escandallo",
    nombre: "Escandallo culinario o ficha técnica",
    aliases: ["ficha tecnica", "receta estándar", "gramaje"],
    categoria: "Costeo y Escandallo",
    indicador: "Documento base de la receta",
    definicion:
      "Documento que estandariza ingredientes, cantidades, rendimiento, costo por porción y procedimiento de una receta.",
    formulaTitulo: "Costo por porción",
    formula: "Costo porción = Σ (Cantidad neta × Costo unitario EP) / Rendimiento",
    recomendacion:
      "Acompaña la ficha con instrumentos de medición y verifica periódicamente que las porciones servidas coincidan con ella.",
    aplicacion: "Producción y capacitación de cocina",
  },
  {
    id: "overhead",
    nombre: "Costos indirectos (Overhead o C.I.F.)",
    aliases: ["CIF", "costos fijos", "gastos indirectos"],
    categoria: "Métricas Financieras",
    indicador: "Se calibra con la operación real",
    definicion:
      "Costos necesarios para operar que no pueden atribuirse directamente a un ingrediente, como arriendo, servicios y aseo.",
    formulaTitulo: "Tasa de asignación",
    formula: "% Overhead = (Costos indirectos del período / Ventas netas) × 100",
    recomendacion:
      "Recalibra la tasa cuando cambie el nivel de ventas o la estructura de gastos; no la trates como un porcentaje permanente.",
    aplicacion: "Presupuesto y definición de precios",
  },
  {
    id: "ppp",
    nombre: "Precio promedio ponderado (PPP)",
    aliases: ["promedio ponderado", "valoración de inventario"],
    categoria: "Inventario y Mermas",
    indicador: "Método de valoración",
    definicion:
      "Promedio que combina el valor del stock disponible con una nueva compra para obtener un costo unitario actualizado.",
    formulaTitulo: "Fórmula ponderada",
    formula: "PPP = (Valor stock anterior + Valor compra) / Cantidad total",
    recomendacion:
      "Mantén cantidades y unidades homologadas antes de ponderar. Mezclar kilogramos con unidades produce costos inválidos.",
    aplicacion: "Valoración de existencias",
  },
  {
    id: "varianza-inventario",
    nombre: "Varianza de inventario",
    aliases: ["discrepancia", "diferencia de inventario", "merma invisible"],
    categoria: "Inventario y Mermas",
    indicador: "Tolerancia operativa: 2%",
    definicion:
      "Diferencia entre la existencia teórica del sistema y la cantidad encontrada durante el conteo físico.",
    formulaTitulo: "Cálculo de varianza",
    formula: "% Varianza = ((Stock físico − Stock teórico) / Stock teórico) × 100",
    recomendacion:
      "Investiga y justifica las diferencias que superen la tolerancia de 2%; no ajustes el stock sin documentar la causa.",
    aplicacion: "Conciliación y auditoría de inventario",
  },
  {
    id: "margen-contribucion",
    nombre: "Margen de contribución unitario (MCU)",
    aliases: ["margen unitario", "rentabilidad", "ingeniería de menú"],
    categoria: "Ingeniería de Menú",
    indicador: "Se expresa en moneda",
    definicion:
      "Dinero que aporta cada unidad vendida después de descontar su costo directo y que queda disponible para cubrir costos indirectos.",
    formulaTitulo: "Fórmula monetaria",
    formula: "MCU = PVP neto − Costo directo por porción",
    recomendacion:
      "Analízalo junto con la popularidad. Un plato con buen porcentaje puede aportar poco dinero si su precio es bajo.",
    aplicacion: "Clasificación de la matriz de menú",
  },
  {
    id: "base-gravable",
    nombre: "Base gravable y cálculo de impuestos",
    aliases: ["IVA", "impoconsumo", "PVP neto", "retrocalculo"],
    categoria: "Tributación y Precios",
    indicador: "Separa ingreso e impuesto",
    definicion:
      "Valor neto sobre el que se calcula el impuesto. El precio mostrado al cliente puede incluir una suma que no es ingreso del negocio.",
    formulaTitulo: "Precio neto",
    formula: "PVP neto = Precio final / (1 + Tasa de impuesto)",
    recomendacion:
      "Calcula margen y food cost sobre el precio neto; aplica la tasa tributaria vigente que corresponda a tu operación.",
    aplicacion: "Precios, caja y conciliación contable",
  },
] as const;

function normalizarBusqueda(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function filtrarTerminosGlosario(
  terminos: readonly TerminoGlosario[],
  busqueda: string,
  categoria: FiltroCategoriaGlosario = "Todos",
): TerminoGlosario[] {
  const consulta = normalizarBusqueda(busqueda);

  return terminos.filter((termino) => {
    if (categoria !== "Todos" && termino.categoria !== categoria) return false;
    if (!consulta) return true;

    const contenido = normalizarBusqueda(
      [
        termino.nombre,
        ...termino.aliases,
        termino.categoria,
        termino.indicador,
        termino.definicion,
        termino.formula,
        termino.recomendacion,
        termino.aplicacion,
      ].join(" "),
    );

    return contenido.includes(consulta);
  });
}
