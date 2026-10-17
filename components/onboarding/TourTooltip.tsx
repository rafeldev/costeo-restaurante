"use client";

import type { TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/Button";

export function TourTooltip({
  backProps,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      aria-labelledby="onboarding-tour-title"
      aria-describedby="onboarding-tour-content"
      className="w-[min(360px,calc(100vw-32px))] rounded-xl bg-[var(--paper)] p-5 text-left shadow-[var(--shadow-modal)] motion-reduce:transition-none"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
        Recorrido de bienvenida
      </p>
      {step.title ? (
        <h2 id="onboarding-tour-title" className="mt-1 text-sm font-semibold text-primary">
          {step.title}
        </h2>
      ) : null}
      <div id="onboarding-tour-content" className="mt-2 text-sm leading-6 text-secondary">
        {step.content}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            className="px-3 text-xs"
            aria-label={skipProps["aria-label"]}
            title={skipProps.title}
            data-action="skip"
            onClick={skipProps.onClick}
          >
            Omitir
          </Button>
          <span className="text-xs tabular-nums text-muted" aria-live="polite">
            {index + 1} de {size}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {index > 0 ? (
            <Button
              variant="secondary"
              className="px-3 text-xs"
              aria-label={backProps["aria-label"]}
              title={backProps.title}
              data-action="back"
              onClick={backProps.onClick}
            >
              Atrás
            </Button>
          ) : null}
          <Button
            variant="primary"
            className="px-3 text-xs"
            aria-label={primaryProps["aria-label"]}
            title={primaryProps.title}
            data-action="primary"
            onClick={primaryProps.onClick}
          >
            {isLastStep ? "Finalizar" : "Siguiente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
