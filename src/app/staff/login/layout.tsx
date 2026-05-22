/** Avoid a cached static shell with an empty client main on /staff/login. */
export const dynamic = "force-dynamic";

export default function StaffLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
