import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.PUBLIC_SITE_URL ?? site?.toString() ?? '';
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', base).toString()}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
