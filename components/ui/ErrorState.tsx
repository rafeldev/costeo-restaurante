import { type ReactNode } from "react";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Reintentar",
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--danger-bg)] py-8 text-center sm:py-10 ${className}`.trim()}
      role="alert"
    >
      <p className="text-sm font-medium text-[var(--danger-text)]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          className="btn-secondary min-h-9 px-4 text-sm"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
