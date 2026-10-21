"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAVIGATION_FALLBACK_MS = 8000;

export function GlobalLoadingBar() {
  const [fetchActive, setFetchActive] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const fetchCount = useRef(0);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (...args: Parameters<typeof fetch>) => {
      fetchCount.current += 1;
      setFetchActive(true);
      try {
        return await originalFetch(...args);
      } finally {
        fetchCount.current = Math.max(0, fetchCount.current - 1);
        if (fetchCount.current === 0) setFetchActive(false);
      }
    }) as typeof fetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setNavigating(true);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      fallbackTimer.current = setTimeout(() => setNavigating(false), NAVIGATION_FALLBACK_MS);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
    setNavigating(false);
  }, [pathname, searchParams]);

  const active = fetchActive || navigating;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-[color:var(--border-subtle)] transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="global-loading-bar-sweep h-full w-1/3 bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]" />
    </div>
  );
}
