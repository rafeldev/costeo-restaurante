"use client";

import { useCallback, type ReactNode } from "react";

export type TabItem<T extends string> = {
  key: T;
  label: string;
  panel: ReactNode;
};

type TabsProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  "aria-label": string;
};

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  "aria-label": ariaLabel,
}: TabsProps<T>) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex = index;
      if (e.key === "ArrowRight" || e.key === "Home") {
        e.preventDefault();
        nextIndex = e.key === "Home" ? 0 : Math.min(index + 1, items.length - 1);
      } else if (e.key === "ArrowLeft" || e.key === "End") {
        e.preventDefault();
        nextIndex = e.key === "End" ? items.length - 1 : Math.max(index - 1, 0);
      }
      if (nextIndex !== index) onChange(items[nextIndex]!.key);
    },
    [items, onChange]
  );

  return (
    <section>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="mb-4 flex flex-wrap gap-0 border-b border-[var(--border)]"
      >
        {items.map((tab, index) => {
          const isActive = tab.key === value;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              id={`tab-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              className={`min-h-11 cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition sm:px-5 ${
                isActive
                  ? "border-[var(--accent)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-secondary)] hover:border-[var(--border)] hover:text-[var(--ink)]"
              }`}
              onClick={() => onChange(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {items.map((tab) => (
        <div
          key={tab.key}
          id={`tabpanel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.key}`}
          hidden={tab.key !== value}
          className={tab.key !== value ? "sr-only" : undefined}
        >
          {tab.key === value ? tab.panel : null}
        </div>
      ))}
    </section>
  );
}
