import type { Locale } from './constants';

/**
 * Single source of truth for what exists on this site.
 *
 * Navigation, the sitemap, breadcrumbs, related-tool links and the home page
 * all read from here, so adding a tool is one entry rather than a hunt through
 * the codebase. That marginal cost is what decides how fast the site can grow.
 */
export interface ToolMeta {
  /** Stable key. Also the i18n namespace. Never changes once published. */
  id: string;
  /** Localized slug per locale — a Spanish page on an English slug will not rank in Spanish search. */
  slugs: Record<Locale, string>;
  category: 'rates' | 'taxes' | 'projects';
  /** Ids of related tools, for internal cross-linking. */
  related: string[];
  /**
   * draft: routes exist but the page is noindex and hidden from navigation and
   * the sitemap, so an unfinished tool can be reviewed on a preview deployment
   * without a half-built page entering the search index.
   * Promote to published only when the skill's definition of done is met.
   */
  status: 'draft' | 'published';
}

export const TOOLS: ToolMeta[] = [
  {
    id: 'targetRate',
    slugs: {
      en: 'freelance-rate-calculator',
      es: 'calculadora-de-tarifas-freelance',
    },
    category: 'rates',
    related: [],
    status: 'draft',
  },
];

export function getTool(id: string): ToolMeta {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) throw new Error(`Unknown tool id: "${id}". Register it in src/lib/registry.ts.`);
  return tool;
}

/** Absolute path for a tool in a given locale, e.g. /en/freelance-rate-calculator/ */
export function toolPath(tool: ToolMeta, locale: Locale): string {
  return `/${locale}/${tool.slugs[locale]}/`;
}

/** locale -> path, in the shape the SEO component wants for hreflang. */
export function toolAlternates(tool: ToolMeta): Record<Locale, string> {
  return {
    en: toolPath(tool, 'en'),
    es: toolPath(tool, 'es'),
  };
}

export function publishedTools(): ToolMeta[] {
  return TOOLS.filter((t) => t.status === 'published');
}
