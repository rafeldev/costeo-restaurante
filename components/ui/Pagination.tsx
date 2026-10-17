"use client";

import { getPaginationMetadata } from "@/lib/pagination";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

function getVisiblePages(page: number, totalPages: number) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
}

export function Pagination({ page, pageSize, total, onPageChange, className = "" }: PaginationProps) {
  const metadata = getPaginationMetadata(total, { page, pageSize });
  const visiblePages = getVisiblePages(metadata.page, metadata.totalPages);

  return (
    <nav
      className={`flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
      aria-label="Paginación"
    >
      <p className="text-sm text-secondary" aria-live="polite">
        Mostrando {metadata.from === metadata.to ? metadata.from : `${metadata.from}–${metadata.to}`} de{" "}
        {metadata.total}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="btn-secondary inline-flex min-h-11 items-center px-3 text-sm"
          disabled={!metadata.hasPreviousPage}
          onClick={() => onPageChange(metadata.page - 1)}
          aria-label="Ir a la página anterior"
        >
          Anterior
        </button>
        {visiblePages.map((item, index) => {
          const previous = visiblePages[index - 1];
          return (
            <span key={item} className="contents">
              {previous !== undefined && item - previous > 1 ? (
                <span className="inline-flex min-h-11 min-w-8 items-center justify-center text-muted" aria-hidden="true">
                  …
                </span>
              ) : null}
              <button
                type="button"
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)] ${
                  item === metadata.page
                    ? "bg-[var(--ink)] text-white"
                    : "text-secondary hover:bg-[var(--control-bg)] hover:text-primary"
                }`}
                onClick={() => onPageChange(item)}
                aria-current={item === metadata.page ? "page" : undefined}
                aria-label={`Ir a la página ${item}`}
              >
                {item}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className="btn-secondary inline-flex min-h-11 items-center px-3 text-sm"
          disabled={!metadata.hasNextPage}
          onClick={() => onPageChange(metadata.page + 1)}
          aria-label="Ir a la página siguiente"
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}
