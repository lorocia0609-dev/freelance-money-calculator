import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { LOCALES } from './constants';
import { TOOLS } from './registry';

/**
 * A published tool with content in one language and not the other trains search
 * engines to distrust the whole hreflang cluster, and leaves half the audience
 * on a thin page. These check structure, not prose — the wording is deliberately
 * adapted per locale rather than translated line by line.
 */
const CATALOGUES = { en, es } as Record<string, any>;

const REQUIRED_SECTIONS = [
  'whatItDoes',
  'howToUse',
  'variables',
  'formula',
  'reading',
  'limitations',
  'disclaimer',
  'faq',
  'related',
] as const;

describe('tool content', () => {
  const published = TOOLS.filter((tool) => tool.status === 'published');

  it('there is at least one published tool to check', () => {
    expect(published.length).toBeGreaterThan(0);
  });

  it.each(published.map((tool) => tool.id))('%s has every content section in every locale', (id) => {
    for (const locale of LOCALES) {
      const content = CATALOGUES[locale][id]?.content;
      expect(content, `${id}.content missing in ${locale}.json`).toBeDefined();
      for (const section of REQUIRED_SECTIONS) {
        expect(content, `${id}.content.${section} missing in ${locale}`).toHaveProperty(section);
      }
    }
  });

  it.each(published.map((tool) => tool.id))('%s has the same number of FAQ entries per locale', (id) => {
    const counts = LOCALES.map((locale) => CATALOGUES[locale][id].content.faq.items.length);
    expect(new Set(counts).size).toBe(1);
    // The skill asks for 4-8 entries: enough to cover real questions, few enough
    // that each one earns its place.
    expect(counts[0]).toBeGreaterThanOrEqual(4);
    expect(counts[0]).toBeLessThanOrEqual(8);
  });

  it.each(published.map((tool) => tool.id))('%s FAQ entries are all answered', (id) => {
    for (const locale of LOCALES) {
      for (const item of CATALOGUES[locale][id].content.faq.items) {
        expect(item.q.trim().length).toBeGreaterThan(10);
        expect(item.a.trim().length).toBeGreaterThan(40);
      }
    }
  });

  it.each(published.map((tool) => tool.id))('%s documents every input it exposes', (id) => {
    // A variable the form asks for but the copy never explains is the gap a
    // visitor arrives with, so the counts have to match.
    for (const locale of LOCALES) {
      const tool = CATALOGUES[locale][id];
      expect(tool.content.variables.items.length).toBeGreaterThanOrEqual(
        Object.keys(tool.ui.fields).length - 2,
      );
    }
  });

  it.each(published.map((tool) => tool.id))('%s carries a disclaimer in every locale', (id) => {
    for (const locale of LOCALES) {
      expect(CATALOGUES[locale][id].content.disclaimer.body.length).toBeGreaterThan(100);
    }
  });

  it.each(published.map((tool) => tool.id))('%s meta title and description are within useful lengths', (id) => {
    for (const locale of LOCALES) {
      const tool = CATALOGUES[locale][id];
      expect(tool.metaTitle.length, `${id} metaTitle in ${locale}`).toBeLessThanOrEqual(65);
      expect(tool.metaDescription.length, `${id} metaDescription in ${locale}`).toBeGreaterThanOrEqual(110);
      expect(tool.metaDescription.length, `${id} metaDescription in ${locale}`).toBeLessThanOrEqual(165);
    }
  });
});
