/** ISO 3166-1 alpha-2 codes offered at checkout (Iraq first). */
export const CHECKOUT_COUNTRIES = [
  "IQ",
  "AE",
  "SA",
  "KW",
  "QA",
  "BH",
  "OM",
  "JO",
  "LB",
  "TR",
  "EG",
  "US",
  "GB",
  "DE",
  "FR",
  "CA",
  "AU",
  "OTHER",
] as const;

export type CountryCode = (typeof CHECKOUT_COUNTRIES)[number];

export const IRAQ_COUNTRY_CODE: CountryCode = "IQ";

export function isIraqCountry(code: string | undefined | null): boolean {
  return !code || code === IRAQ_COUNTRY_CODE;
}

/** Minimum phone length for international orders (digits only). */
export const INTERNATIONAL_PHONE_MIN_DIGITS = 7;

export function isValidInternationalPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= INTERNATIONAL_PHONE_MIN_DIGITS;
}
