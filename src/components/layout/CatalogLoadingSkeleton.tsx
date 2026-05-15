/**
 * Loading UI — server-safe (no Store/locale hooks).
 * - `full`: optional full-page skeleton (static wordmark bar) — unused by default layout.
 * - `embedded`: inside `<main>` during route transitions (`app/loading.tsx`) — no duplicate header.
 */
export function CatalogLoadingSkeleton({ variant = "full" }: { variant?: "full" | "embedded" }) {
  const body = (
    <div className="page-gutter flex flex-1 flex-col py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-10 animate-pulse">
        <div
          className="mx-auto h-2 w-32 max-w-full rounded-full md:h-2.5 md:w-40"
          style={{ background: "color-mix(in srgb, var(--foreground) 14%, transparent)" }}
        />
        <div
          className="mx-auto h-8 w-full max-w-xl rounded-sm md:h-9"
          style={{ background: "color-mix(in srgb, var(--foreground) 8%, transparent)" }}
        />
        <div
          className="mx-auto h-px w-24 rounded-full opacity-80"
          style={{ background: "linear-gradient(90deg, transparent, var(--color-gold), transparent)" }}
        />
        <div className="mt-2 grid flex-1 grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-4">
              <div
                className="aspect-square w-full rounded-sm"
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
              />
              <div
                className="mx-auto h-3 w-[75%] rounded-full"
                style={{ background: "color-mix(in srgb, var(--foreground) 10%, transparent)" }}
              />
              <div
                className="mx-auto h-3 w-[50%] rounded-full"
                style={{ background: "color-mix(in srgb, var(--foreground) 6%, transparent)" }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (variant === "embedded") {
    return (
      <div
        className="flex w-full min-w-0 flex-1 flex-col"
        role="status"
        aria-live="polite"
        aria-label="Loading — جاري التحميل"
      >
        {body}
      </div>
    );
  }

  return (
    <div
      className="site-main flex min-h-[min(100dvh,100vh)] w-full min-w-0 flex-1 flex-col"
      role="status"
      aria-live="polite"
      aria-label="Loading — جاري التحميل"
    >
      <header className="page-gutter flex shrink-0 items-center justify-center border-b py-5 md:py-6" style={{ borderColor: "var(--line)" }}>
        <div className="flex flex-col items-center gap-1 select-none" aria-hidden>
          <span className="font-display text-2xl tracking-luxe uppercase md:text-[1.7rem]" style={{ fontWeight: 500 }}>
            MUHRA
          </span>
          <span className="text-[10px] tracking-eyebrow uppercase opacity-70">JEWELRY</span>
        </div>
      </header>
      {body}
    </div>
  );
}
