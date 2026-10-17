import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getPaginationMetadata,
  normalizePagination,
} from "./pagination";

describe("normalizePagination", () => {
  it("usa valores por defecto y calcula el desplazamiento", () => {
    expect(normalizePagination({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      q: "",
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    });
  });

  it("normaliza parámetros válidos desde URLSearchParams", () => {
    const params = new URLSearchParams({ page: "3", pageSize: "25", q: "  pollo   asado  " });

    expect(normalizePagination(params)).toEqual({
      page: 3,
      pageSize: 25,
      q: "pollo asado",
      skip: 50,
      take: 25,
    });
  });

  it("descarta enteros inválidos y limita pageSize", () => {
    expect(normalizePagination({ page: "2.5", pageSize: "1000" })).toMatchObject({
      page: 1,
      pageSize: MAX_PAGE_SIZE,
      skip: 0,
    });
    expect(normalizePagination({ page: "-2", pageSize: "0" })).toMatchObject({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("admite límites configurables y recorta la búsqueda", () => {
    expect(
      normalizePagination(
        { pageSize: "40", q: "abcdefgh" },
        { defaultPageSize: 15, maxPageSize: 30, maxQueryLength: 5 }
      )
    ).toEqual({ page: 1, pageSize: 30, q: "abcde", skip: 0, take: 30 });
  });

  it("mantiene skip dentro del rango de enteros seguros", () => {
    const result = normalizePagination({
      page: String(Number.MAX_SAFE_INTEGER),
      pageSize: "100",
    });

    expect(Number.isSafeInteger(result.skip)).toBe(true);
  });
});

describe("getPaginationMetadata", () => {
  it("calcula páginas, rango y navegación", () => {
    expect(getPaginationMetadata(53, { page: 2, pageSize: 20 })).toEqual({
      total: 53,
      page: 2,
      pageSize: 20,
      totalPages: 3,
      from: 21,
      to: 40,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it("representa un resultado vacío sin rangos negativos", () => {
    expect(getPaginationMetadata(0, { page: 8, pageSize: 20 })).toEqual({
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      from: 0,
      to: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  it("ajusta una página fuera del rango disponible", () => {
    expect(getPaginationMetadata(21, { page: 9, pageSize: 10 })).toMatchObject({
      page: 3,
      totalPages: 3,
      from: 21,
      to: 21,
      hasNextPage: false,
    });
  });
});
