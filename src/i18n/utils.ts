import { DEFAULT_LOCALE, type Locale, isLocale } from '../lib/constants';
import en from './en.json';
import es from './es.json';

const CATALOGUES: Record<Locale, unknown> = { en, es };

/**
 * Looks a key up in the active catalogue.
 *
 * Throws on a missing key rather than falling back silently: a silent fallback
 * to English is exactly how half-translated pages reach production unnoticed,
 * and a bilingual site that quietly serves English to Spanish visitors loses
 * the market it added the locale for.
 */
export function t<T = string>(locale: Locale, key: string): T {
  const segments = key.split('.');
  let node: unknown = CATALOGUES[locale];

  for (const segment of segments) {
    if (typeof node !== 'object' || node === null || !(segment in node)) {
      throw new Error(`Missing translation "${key}" for locale "${locale}".`);
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return node as T;
}

/** Interpolates {placeholders}. Never concatenate fragments — word order differs by language. */
export function tf(locale: Locale, key: string, values: Record<string, string | number>): string {
  return t<string>(locale, key).replace(/\{(\w+)\}/g, (match, name) =>
    name in values ? String(values[name]) : match,
  );
}

export function localeFromPath(pathname: string): Locale {
  const candidate = pathname.split('/').filter(Boolean)[0] ?? '';
  return isLocale(candidate) ? candidate : DEFAULT_LOCALE;
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'es' : 'en';
}
