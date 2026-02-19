"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant = "primary",
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass = variant === "danger" ? "btn-danger" : "btn-primary";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div
        className="absolute inset-0 bg-[var(--ink)]/40"
        aria-hidden
        onClick={onCancel}
      />
      <div className="surface-card relative z-10 w-full max-w-md p-5 shadow-lg sm:p-6">
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-primary">
          {title}
        </h2>
        {description ? (
          <p id="confirm-modal-desc" className="mt-2 text-sm text-secondary">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-3 text-sm text-secondary">{children}</div> : null}
        <div className="mt-6 flex flex-wrap gap-2 justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="btn-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
