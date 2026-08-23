/**
 * robots.txt is generated rather than kept as a static file, because its
 * contents depend on the deployment: the sitemap URL differs per environment,
 * and a deployment that must not be indexed has to say so.
 */
export interface RobotsOptions {
  indexable: boolean;
  sitemapUrl: string;
}

export function buildRobotsTxt({ indexable, sitemapUrl }: RobotsOptions): string {
  if (!indexable) {
    // No sitemap line: advertising a map of pages that must not be crawled
    // invites exactly the crawl this is meant to prevent.
    return ['User-agent: *', 'Disallow: /', ''].join('\n');
  }
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemapUrl}`, ''].join('\n');
}
