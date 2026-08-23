import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { LOCALES } from './src/lib/constants';
import { TOOLS, toolPath } from './src/lib/registry';

// Read from process.env rather than import.meta.env: this file runs in Node
// before Astro's client-side env is available.
const indexable = process.env.PUBLIC_INDEXABLE === 'true';

// Never hardcode the production domain: preview deployments must generate their
// own canonicals and hreflang, or they compete with production in the index.
const site = process.env.PUBLIC_SITE_URL ?? 'https://freelance-money-calculator.pages.dev';

// Draft tools must not enter the search index before they are finished, and the
// root is only a redirect stub. Derived from the registry rather than a hardcoded
// list, so promoting a tool to published needs no change here.
const excludedPaths = new Set<string>(['/']);
for (const tool of TOOLS) {
  if (tool.status !== 'draft') continue;
  for (const locale of LOCALES) excludedPaths.add(toolPath(tool, locale));
}

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    routing: {
      // Both locales are prefixed. A mix of prefixed and unprefixed routes
      // creates duplicate-content ambiguity that is awkward to unwind later.
      prefixDefaultLocale: true,
    },
  },
  integrations: [
    preact(),
    sitemap({
      // A deployment that must not be indexed publishes no sitemap either.
      // Every page already carries noindex and robots.txt disallows crawling;
      // a sitemap would only contradict both.
      filter: (page) => indexable && !excludedPaths.has(new URL(page).pathname),
      i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es' } },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
