import { describe, expect, it } from "vitest";
import {
  filtrarTerminosGlosario,
  TERMINOS_GLOSARIO,
} from "./glosario";

describe("filtrarTerminosGlosario", () => {
  it("ignora acentos y mayúsculas en la búsqueda", () => {
    const resultado = filtrarTerminosGlosario(TERMINOS_GLOSARIO, "FICHA TECNICA");

    expect(resultado.map((termino) => termino.id)).toEqual(["escandallo"]);
  });

  it("combina la categoría con el texto buscado", () => {
    const resultado = filtrarTerminosGlosario(
      TERMINOS_GLOSARIO,
      "tolerancia",
      "Inventario y Mermas",
    );

    expect(resultado.map((termino) => termino.id)).toEqual(["varianza-inventario"]);
  });

  it("devuelve todos los términos de una categoría con búsqueda vacía", () => {
    const resultado = filtrarTerminosGlosario(
      TERMINOS_GLOSARIO,
      "   ",
      "Costeo y Escandallo",
    );

    expect(resultado.map((termino) => termino.id)).toEqual(["food-cost", "escandallo"]);
  });

  it("devuelve un arreglo vacío cuando no hay coincidencias", () => {
    expect(filtrarTerminosGlosario(TERMINOS_GLOSARIO, "sushi molecular")).toEqual([]);
  });
});
