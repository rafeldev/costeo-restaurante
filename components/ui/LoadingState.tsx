import { type ReactNode } from "react";

type LoadingStateProps = {
  message?: string;
  className?: string;
};

export function LoadingState({ message = "Cargando…", className = "" }: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-8 text-secondary sm:py-12 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]"
        aria-hidden
      />
      <p className="text-sm">{message}</p>
    </div>
  );
}
