import type { APIRoute } from 'astro';
import { buildRobotsTxt } from '../lib/robots';
import { INDEXABLE } from '../lib/site';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.PUBLIC_SITE_URL ?? site?.toString() ?? '';
  return new Response(
    buildRobotsTxt({
      indexable: INDEXABLE,
      sitemapUrl: new URL('sitemap-index.xml', base).toString(),
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
