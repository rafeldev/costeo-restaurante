import { type ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--parchment)] py-10 text-center sm:py-12 ${className}`.trim()}
    >
      <p className="text-sm font-medium text-primary">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
