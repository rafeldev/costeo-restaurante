export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_QUERY_LENGTH = 100;

type QueryValue = string | string[] | null | undefined;
type PaginationInput =
  | URLSearchParams
  | {
      page?: QueryValue;
      pageSize?: QueryValue;
      q?: QueryValue;
    };

type PaginationOptions = {
  defaultPageSize?: number;
  maxPageSize?: number;
  maxQueryLength?: number;
};

export type PaginationParams = {
  page: number;
  pageSize: number;
  q: string;
  skip: number;
  take: number;
};

export type PaginationMetadata = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  from: number;
  to: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

function getQueryValue(input: PaginationInput, key: "page" | "pageSize" | "q") {
  const value = input instanceof URLSearchParams ? input.get(key) : input[key];
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: QueryValue, fallback: number) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validOption(value: number | undefined, fallback: number) {
  return Number.isSafeInteger(value) && value! > 0 ? value! : fallback;
}

export function normalizePagination(
  input: PaginationInput,
  options: PaginationOptions = {}
): PaginationParams {
  const maxPageSize = validOption(options.maxPageSize, MAX_PAGE_SIZE);
  const defaultPageSize = Math.min(
    validOption(options.defaultPageSize, DEFAULT_PAGE_SIZE),
    maxPageSize
  );
  const maxQueryLength = validOption(options.maxQueryLength, MAX_QUERY_LENGTH);
  const requestedPageSize = positiveInteger(getQueryValue(input, "pageSize"), defaultPageSize);
  const pageSize = Math.min(requestedPageSize, maxPageSize);
  const requestedPage = positiveInteger(getQueryValue(input, "page"), DEFAULT_PAGE);
  const maxSafePage = Math.floor(Number.MAX_SAFE_INTEGER / pageSize) + 1;
  const page = Math.min(requestedPage, maxSafePage);
  const rawQuery = getQueryValue(input, "q");
  const q = typeof rawQuery === "string"
    ? rawQuery.trim().replace(/\s+/g, " ").slice(0, maxQueryLength)
    : "";

  return {
    page,
    pageSize,
    q,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function getPaginationMetadata(
  total: number,
  pagination: Pick<PaginationParams, "page" | "pageSize">
): PaginationMetadata {
  const normalizedTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const pageSize = Number.isSafeInteger(pagination.pageSize) && pagination.pageSize > 0
    ? pagination.pageSize
    : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(normalizedTotal / pageSize));
  const requestedPage = Number.isSafeInteger(pagination.page) && pagination.page > 0
    ? pagination.page
    : DEFAULT_PAGE;
  const page = Math.min(requestedPage, totalPages);
  const from = normalizedTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = normalizedTotal === 0 ? 0 : Math.min(page * pageSize, normalizedTotal);

  return {
    total: normalizedTotal,
    page,
    pageSize,
    totalPages,
    from,
    to,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}
