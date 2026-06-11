/** Coarse pointer / touch-primary device (iPad, iPhone, Android tablets). */
export function isCoarsePointerDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return "ontouchstart" in window;
  }
}

/** Yield main thread — keeps iOS Safari responsive during multi-file uploads. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 48 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}
