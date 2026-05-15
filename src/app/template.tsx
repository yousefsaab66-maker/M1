/**
 * Remounts the page subtree on every client navigation (unlike `layout.tsx` which persists).
 * Helps avoid a “stuck” previous page shell when routes are mostly `use client`.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="contents">{children}</div>;
}
