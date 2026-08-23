export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Currency is independent of locale: a Spanish speaker may work in USD and an
 * English speaker in EUR. Adding one here is all that is required — symbol,
 * placement and decimal precision are derived by Intl, not maintained by hand.
 *
 * Deliberately no conversion between currencies: live rates mean an external
 * API, which is a dependency, a rate limit and eventually a bill.
 */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'ARS', 'COP'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'USD';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}
