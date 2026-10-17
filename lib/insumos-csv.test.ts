import { describe, expect, it } from "vitest";
import { parseInsumosCsv } from "@/lib/insumos-csv";

describe("parseInsumosCsv", () => {
  it("normaliza categorías, unidades, decimales y proveedor", () => {
    const csv = [
      "nombre,categoria,unidadBase,costoUnidad,mermaPct,proveedor,presentacionCantidad,presentacionUnidad,precioPresentacion",
      '"Pechuga, fresca",Proteínas y Carnes,g,"0,009",15,PROV-001,1,kg,9',
    ].join("\n");

    const report = parseInsumosCsv(csv);

    expect(report.errores).toEqual([]);
    expect(report.rows[0]).toMatchObject({
      fila: 2,
      proveedor: "PROV-001",
      data: {
        nombre: "Pechuga, fresca",
        categoria: "PROTEINAS_CARNES",
        unidadBase: "GRAMO",
        costoUnidad: 0.009,
        mermaPct: 15,
        presentacionCantidad: 1,
        presentacionUnidad: "KILOGRAMO",
        precioPresentacion: 9,
      },
    });
  });

  it("reporta cada fila inválida y conserva las válidas", () => {
    const csv = [
      "nombre,categoria,unidadBase,costoUnidad,mermaPct",
      "Tomate,Frutas y Verduras,g,0.002,10",
      "X,Categoría desconocida,caja,-1,120",
    ].join("\n");

    const report = parseInsumosCsv(csv);

    expect(report.rows).toHaveLength(1);
    expect(report.errores).toHaveLength(1);
    expect(report.errores[0].fila).toBe(3);
  });

  it("rechaza archivos sin columnas obligatorias", () => {
    const report = parseInsumosCsv("nombre,categoria\nTomate,Frutas y Verduras");
    expect(report.rows).toEqual([]);
    expect(report.errores[0].motivo).toContain("unidadbase");
  });
});
