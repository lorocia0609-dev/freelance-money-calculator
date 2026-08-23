import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { LOCALES } from './constants';
import { TOOLS } from './registry';

/**
 * A key present in one catalogue and missing from another is a bug worth
 * failing the build over: the lookup helper throws on a missing key, so an
 * untranslated string is a runtime error on a live page rather than a cosmetic
 * slip. Catching it here is the cheap moment.
 */
function flatKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flatKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translation catalogues', () => {
  it('have identical key structures across locales', () => {
    expect(flatKeys(en).sort()).toEqual(flatKeys(es).sort());
  });

  it('have no empty strings', () => {
    for (const [name, catalogue] of [['en', en], ['es', es]] as const) {
      for (const key of flatKeys(catalogue)) {
        const value = key.split('.').reduce<any>((node, part) => node?.[part], catalogue);
        expect(String(value).trim(), `${name}.${key} is empty`).not.toBe('');
      }
    }
  });
});

describe('tool registry', () => {
  it('gives every tool a slug in every locale', () => {
    for (const tool of TOOLS) {
      for (const locale of LOCALES) {
        expect(tool.slugs[locale], `${tool.id} has no ${locale} slug`).toBeTruthy();
      }
    }
  });

  it('uses a distinct slug per locale', () => {
    // A Spanish page on an English slug does not rank in Spanish-language search.
    for (const tool of TOOLS) {
      const slugs = Object.values(tool.slugs);
      expect(new Set(slugs).size, `${tool.id} reuses one slug across locales`).toBe(slugs.length);
    }
  });

  it('has the translation keys every tool page renders', () => {
    for (const tool of TOOLS) {
      for (const locale of LOCALES) {
        const catalogue = locale === 'en' ? en : es;
        const namespace = (catalogue as Record<string, unknown>)[tool.id];
        expect(namespace, `no "${tool.id}" namespace in ${locale}.json`).toBeDefined();
        for (const key of ['title', 'shortDescription', 'metaTitle', 'metaDescription']) {
          expect(namespace as Record<string, unknown>).toHaveProperty(key);
        }
      }
    }
  });

  it('has unique tool ids', () => {
    const ids = TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
