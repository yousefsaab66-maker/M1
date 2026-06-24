export const CUSTOMER_NOTE_MAX_LENGTH = 500;

/** Trim and cap length; empty strings become undefined. */
export function normalizeCustomerNote(note?: string | null): string | undefined {
  if (note == null) return undefined;
  const trimmed = note.trim();
  if (!trimmed) return undefined;
  return trimmed.length > CUSTOMER_NOTE_MAX_LENGTH
    ? trimmed.slice(0, CUSTOMER_NOTE_MAX_LENGTH)
    : trimmed;
}
