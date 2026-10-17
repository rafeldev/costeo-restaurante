import { describe, expect, it } from "vitest";
import { groupRecetasCsv, parseRecetasCsv } from "./recetas-csv";

const header = "nombre,categoria,rendimientoPorciones,tiempoPreparacionMin,pvpCarta,borrador,activa,insumoCodigo,cantidad";

describe("importación CSV de recetas", () => {
  it("agrupa varias líneas como ingredientes de una sola receta", () => {
    const parsed = parseRecetasCsv([
      header,
      "Hamburguesa,HAMBURGUESAS,1,15,22000,false,true,INS-001,1",
      "Hamburguesa,HAMBURGUESAS,1,15,22000,false,true,INS-002,180",
    ].join("\n"));
    const grouped = groupRecetasCsv(parsed.rows);

    expect(parsed.errores).toEqual([]);
    expect(grouped.errores).toEqual([]);
    expect(grouped.recipes).toHaveLength(1);
    expect(grouped.recipes[0]?.ingredientes).toEqual([
      { insumoCodigo: "INS-001", cantidad: 1 },
      { insumoCodigo: "INS-002", cantidad: 180 },
    ]);
  });

  it("reporta categorías inválidas y cantidades no positivas por fila", () => {
    const parsed = parseRecetasCsv([
      header,
      "Hamburguesa,OTRA,1,15,22000,false,true,INS-001,0",
    ].join("\n"));

    expect(parsed.rows).toEqual([]);
    expect(parsed.errores).toEqual([{
      fila: 2,
      motivo: "Categoría inválida. Cantidad inválida",
    }]);
  });

  it("rechaza un insumo repetido dentro de la misma receta", () => {
    const parsed = parseRecetasCsv([
      header,
      "Hamburguesa,HAMBURGUESAS,1,15,22000,false,true,INS-001,1",
      "Hamburguesa,HAMBURGUESAS,1,15,22000,false,true,ins-001,2",
    ].join("\n"));
    const grouped = groupRecetasCsv(parsed.rows);

    expect(grouped.recipes).toEqual([]);
    expect(grouped.errores).toEqual([{
      fila: 3,
      motivo: "Insumo repetido en la receta Hamburguesa",
    }]);
  });
});
