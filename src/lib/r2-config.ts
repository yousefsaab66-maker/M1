/** Public R2 origin — Worker runtime may only have `R2_PUBLIC_BASE_URL`; build may only bake `NEXT_PUBLIC_*`. */
export function getR2PublicBaseUrl(): string {
  return (
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
    ""
  );
}

export function isR2PublicConfigured(): boolean {
  return getR2PublicBaseUrl().length > 0;
}

/** Client bundle — when set, staff UI must use cloud upload (never silent data: URLs). */
export function isR2PublicConfiguredClient(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim());
}
