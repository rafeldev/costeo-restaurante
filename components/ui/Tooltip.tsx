"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  label?: string;
};

export function Tooltip({ content, children, className = "", label }: TooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const openedByFocusRef = useRef(false);

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      openedByFocusRef.current = false;
      return;
    }
    if (label && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openedByFocusRef.current = false;
      setOpen((current) => !current);
    }
  }

  return (
    <span
      className={`relative inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--ring)] ${className}`.trim()}
      tabIndex={0}
      role={label ? "button" : undefined}
      aria-label={label}
      aria-describedby={tooltipId}
      onClick={label ? () => {
        if (openedByFocusRef.current) {
          openedByFocusRef.current = false;
          return;
        }
        setOpen((current) => !current);
      } : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onFocus={() => {
        openedByFocusRef.current = true;
        setOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          openedByFocusRef.current = false;
          setOpen(false);
        }
      }}
    >
      {children}
      <span className="absolute bottom-full left-0 h-2 w-full" aria-hidden />
      <span
        id={tooltipId}
        role="tooltip"
        className={`absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-64 -translate-x-1/2 rounded-md bg-[var(--ink)] px-2.5 py-1.5 text-center text-xs leading-5 text-white shadow-[var(--shadow-popover)] transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {content}
      </span>
    </span>
  );
}
