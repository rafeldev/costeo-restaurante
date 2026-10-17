import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-[var(--success-surface)] text-[var(--success-text)]",
  warning: "bg-[var(--warning-surface)] text-[var(--warning-text)]",
  danger: "bg-[var(--danger-surface)] text-[var(--danger-text)]",
  neutral: "bg-[var(--control-bg)] text-secondary",
  info: "bg-[var(--info-surface)] text-[var(--info-text)]",
};

export function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]} ${className}`.trim()}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export type Status =
  | "Rentable"
  | "Ajustar"
  | "Riesgo"
  | "Sin dato"
  | "Crítico"
  | "Reorden"
  | "Sano";

const statusTones: Record<Status, BadgeTone> = {
  Rentable: "success",
  Ajustar: "warning",
  Riesgo: "danger",
  "Sin dato": "neutral",
  Crítico: "danger",
  Reorden: "warning",
  Sano: "success",
};

export function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  return (
    <Badge tone={statusTones[status]} className={className}>
      {status}
    </Badge>
  );
}
