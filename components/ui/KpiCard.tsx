import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

type KpiCardProps = {
  title: string;
  value: ReactNode;
  trend?: ReactNode;
  trendTone?: BadgeTone;
  description?: string;
  className?: string;
};

export function KpiCard({
  title,
  value,
  trend,
  trendTone = "neutral",
  description,
  className = "",
}: KpiCardProps) {
  return (
    <article className={`surface-card p-4 sm:p-5 ${className}`.trim()}>
      <p className="label-sm text-xs font-semibold uppercase tracking-[0.08em] text-tertiary">{title}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <p className="kpi-value text-2xl font-bold tracking-tight text-primary sm:text-3xl">{value}</p>
        {trend !== undefined ? <Badge tone={trendTone}>{trend}</Badge> : null}
      </div>
      {description ? <p className="mt-2 text-xs leading-5 text-secondary">{description}</p> : null}
    </article>
  );
}
