import { describe, expect, it } from 'vitest';
import { buildRobotsTxt } from './robots';

const SITEMAP = 'https://example.com/sitemap-index.xml';

describe('buildRobotsTxt', () => {
  it('invites crawling and points at the sitemap when indexable', () => {
    const txt = buildRobotsTxt({ indexable: true, sitemapUrl: SITEMAP });
    expect(txt).toContain('Allow: /');
    expect(txt).toContain(`Sitemap: ${SITEMAP}`);
    expect(txt).not.toContain('Disallow: /');
  });

  it('blocks everything when the deployment must not be indexed', () => {
    const txt = buildRobotsTxt({ indexable: false, sitemapUrl: SITEMAP });
    expect(txt).toContain('Disallow: /');
    expect(txt).not.toContain('Allow: /');
  });

  it('does not advertise a sitemap it does not want crawled', () => {
    expect(buildRobotsTxt({ indexable: false, sitemapUrl: SITEMAP })).not.toContain('Sitemap:');
  });

  it('ends with a newline, as the format expects', () => {
    for (const indexable of [true, false]) {
      expect(buildRobotsTxt({ indexable, sitemapUrl: SITEMAP }).endsWith('\n')).toBe(true);
    }
  });
});
