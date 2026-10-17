import Link from "next/link";
import type { ReactNode } from "react";

type EducationalCalloutProps = {
  title: string;
  children: ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
};

export function EducationalCallout({
  title,
  children,
  href = "/glosario",
  linkLabel = "Consultar la Guía de Costeo",
  className = "",
}: EducationalCalloutProps) {
  return (
    <aside
      className={`rounded-xl border border-[var(--info-border)] bg-[var(--info-surface)] p-4 text-[var(--info-text)] sm:p-5 ${className}`.trim()}
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="mt-0.5 h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="mt-1 text-sm leading-6 text-secondary">{children}</div>
          <Link
            href={href}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--info-text)] underline underline-offset-4 focus-visible:rounded focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)]"
          >
            {linkLabel}
          </Link>
        </div>
      </div>
    </aside>
  );
}
