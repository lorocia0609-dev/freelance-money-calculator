import type { Currency, Locale } from './constants';

/**
 * The only place a number becomes a displayed amount.
 *
 * Formatting by hand gets decimal separators, thousands separators and symbol
 * placement wrong for at least one locale — English and Spanish disagree on all
 * three. Tool modules return raw numbers; this turns them into strings.
 */
export function formatCurrency(
  value: number,
  locale: Locale,
  currency: Currency,
  options: { maximumFractionDigits?: number } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(value);
}

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
}
