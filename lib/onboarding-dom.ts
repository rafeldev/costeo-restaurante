export function waitForElement(
  selector: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Element | null> {
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (element: Element | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeout);
      signal?.removeEventListener("abort", handleAbort);
      resolve(element);
    };
    const handleAbort = () => finish(null);
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) finish(element);
    });
    const timeout = window.setTimeout(() => finish(null), timeoutMs);

    signal?.addEventListener("abort", handleAbort, { once: true });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
