import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  id?: string;
  children: ReactNode;
};

export function Field({ label, error, hint, id: idProp, children }: FieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  const child =
    typeof children === "object" &&
    children !== null &&
    "type" in children &&
    typeof (children as ReactElement).type === "string"
      ? cloneElement(children as ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>, {
          id,
          "aria-describedby": describedBy || undefined,
          "aria-invalid": !!error,
        })
      : children;

  return (
    <div className="block text-sm">
      <label htmlFor={id} className="mb-1.5 block font-medium text-primary">
        {label}
      </label>
      {child}
      {hint ? (
        <span id={hintId} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="mt-1 block text-xs font-medium text-[var(--danger-text)]" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
