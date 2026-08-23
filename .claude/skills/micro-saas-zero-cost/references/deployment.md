# Deployment: Cloudflare Pages + GitHub Actions

## Why Cloudflare Pages

- Free tier with unlimited bandwidth and unlimited requests, which is the point:
  a traffic spike must never produce a bill.
- Builds directly from the GitHub repository, with an automatic preview
  deployment for every pull request.
- Free custom domain and TLS, plus `_headers` and `_redirects` control — both
  needed for SEO housekeeping.
- Free cookieless web analytics.
- Global edge network, which matters for a bilingual site serving two continents.

GitHub Pages is a reasonable alternative if the user prefers staying entirely
within GitHub. It has softer bandwidth limits and no PR previews, but the build
output is identical, so switching later costs minutes. Never present either as a
lock-in.

## First-time setup

1. Push the repository to GitHub.
2. In Cloudflare Pages, create a project and connect the repository.
3. Build configuration:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: pin it via `.nvmrc` or the `NODE_VERSION` variable so local,
     CI and Pages builds agree.
4. Set the production branch. Every other branch produces a preview deployment.
5. Set the site's canonical base URL as an environment variable and use it when
   generating canonicals, hreflang and the sitemap — hardcoding the domain in
   templates breaks preview builds.

## Headers and redirects

`public/_headers`:

- Send `X-Robots-Tag: noindex` for preview deployments so they never compete with
  production in the index.
- Long-lived immutable caching for hashed static assets; short cache for HTML.
- Baseline security headers: `X-Content-Type-Options`, `Referrer-Policy`,
  and a `Content-Security-Policy` — note that enabling ads later requires
  widening the CSP, so write it as something you expect to revisit.

`public/_redirects`:

- Enforce one trailing-slash convention.
- Redirect the bare root to the default locale.
- Add a 301 for every slug that ever changes, in the same commit as the change.

## CI pipeline

Cloudflare builds and deploys; GitHub Actions is what stops broken work from
getting there. On every pull request and every push to the main branch:

```
install (npm ci) -> typecheck -> test -> build -> audit
```

The audit step runs the bundled `scripts/audit.mjs` against `dist/`. Catching a
missing canonical or a broken hreflang pair in a pull request costs a minute;
catching it in Search Console costs weeks of indexing. `assets/templates/ci.yml`
is a working starting point.

Keep CI fast — under two minutes — or it stops being run before merge.

## Custom domain

1. Add the domain in the Pages project and follow the DNS instructions.
2. Verify TLS is active before publishing links anywhere.
3. Redirect the `www` variant to the apex (or the reverse — just pick one).
4. Update the canonical base URL variable, then rebuild so canonicals, hreflang
   and the sitemap all use the final domain.

Do this before submitting to Search Console or applying to an ad network.

## Post-deploy verification

1. Production URL serves the built site over HTTPS.
2. `/robots.txt` and `/sitemap.xml` resolve and reference the production domain.
3. `view-source` on a tool page shows the full content without JavaScript.
4. Both locales resolve and their hreflang links are reciprocal and absolute.
5. A preview deployment returns `noindex`.
6. Lighthouse mobile run meets the budgets in `performance-a11y.md`.
7. Search Console: property verified, sitemap submitted, both locales present.
