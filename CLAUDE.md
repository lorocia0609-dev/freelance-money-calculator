# Freelance Money Calculator

Free web tools that help freelancers work out what they need to charge.

## How to work on this project

This repository follows the **`micro-saas-zero-cost` skill**
(`.claude/skills/micro-saas-zero-cost/`). Read it before making structural
changes — it carries the principles, the build order, the add-a-tool loop and
the definition of done. This file records only what is specific to *this*
product. Where the two disagree, this file wins; if the disagreement looks like
a genuine improvement, raise it so the skill can be updated deliberately.

## Product decisions

| Decision | Value |
|---|---|
| Product name | Freelance Money Calculator |
| Primary locale | English (`en`) — default, `x-default` target |
| Secondary locale | Spanish (`es`) — shipped from day one, full parity |
| Default currency | USD |
| Hosting | Cloudflare Pages, connected to this GitHub repository |
| Future monetization | Google AdSense (prepared, not enabled) |
| MVP scope | No login, no database, no payment or third-party services |
| First tool | Target-income rate calculator: what to charge to reach an income goal |

### Why these were chosen

- **English first** because the addressable search volume for freelance-rate
  queries is larger in English, and the ad rates on that traffic are higher.
  Spanish ships alongside it rather than later, because retrofitting a locale
  forfeits accumulated rankings.
- **USD as default** because it matches the primary-locale audience. Currency is
  independent of locale in the code: a Spanish speaker may work in USD and an
  English speaker in EUR, so both are selected separately. No currency
  *conversion* — that requires a live rates API, which is a dependency, a rate
  limit and eventually a bill. The tool computes in whichever currency the user
  picks and says so.

## Currency

- `USD` is the default, defined in `src/lib/constants.ts`.
- Adding a currency means adding its ISO 4217 code to `SUPPORTED_CURRENCIES`.
  Everything else — symbol, placement, decimal precision — is derived by `Intl`.
- Never format money by hand. `src/lib/format.ts` is the only place that turns a
  number into a displayed amount.

## Locales and routing

- Both locales are prefixed: `/en/...` and `/es/...`. The root `/` redirects to
  `/en/`.
- Slugs are written in the language of their locale and live in
  `src/lib/registry.ts`. A Spanish page on an English slug does not rank in
  Spanish-language search.
- Published slugs are permanent. Changing one ships with a 301 in the same commit.

## Indexing

Two independent switches decide what search engines see. Both must be open for
a page to be indexed.

**Site-wide: `PUBLIC_INDEXABLE`.** When unset or `false`, every page emits
`noindex`, `robots.txt` returns `Disallow: /`, and no sitemap is published.
The default is closed on purpose: indexing a temporary hostname is expensive to
undo, because those URLs compete as duplicates with the real domain until the
redirects and canonicals are re-crawled. Failing to index production is visible
immediately and fixed by setting one variable.

**Per tool: `status` in `registry.ts`.**

- `draft` — routes and content exist, but the page is `noindex`, excluded from
  the sitemap, and carries no structured data. This lets a tool be built and
  reviewed on a live deployment without a half-finished page entering the index.
- `published` — indexable, in the sitemap, linked from navigation, with
  `WebApplication`, `BreadcrumbList` and `FAQPage` markup.

Drafts are hidden from public navigation on an indexable deployment. On a
deployment that is not indexable there is no crawl graph to protect and reaching
the tool is the point, so they are listed.

Promote a tool to `published` only when it meets the skill's definition of done.

## Going live

The site is currently deployed for testing, not for search. To open it up once
the custom domain is in place:

1. Point the domain at the Pages project and confirm TLS is active.
2. Set `PUBLIC_SITE_URL` to the final domain in the Cloudflare production
   environment. Canonicals, hreflang and the sitemap all derive from it.
3. Set `PUBLIC_INDEXABLE=true` in the production environment only. Preview
   environments must keep it unset.
4. Change `status` to `'published'` in `src/lib/registry.ts` for each tool that
   meets the definition of done.
5. Rebuild and verify: pages no longer carry `noindex`, `/robots.txt` allows
   crawling and names the sitemap, `/sitemap-index.xml` resolves, and a tool
   page carries all three JSON-LD blocks.
6. Only then submit to Search Console.

Steps 3 and 4 are independent. Opening the site without promoting a tool leaves
that tool `noindex` on an otherwise indexable site, which is a valid state.

Before step 3, finish the legal pages: they are still drafts, and they are a
prerequisite for the AdSense application, not just for indexing.

## Monetization state

Ads are **not enabled**. `AdSlot` components reserve their space and render
nothing. Enabling them later is:

1. `PUBLIC_ADS_ENABLED=true` in the Cloudflare Pages environment,
2. the AdSense script in `BaseLayout.astro`,
3. a widened `Content-Security-Policy` in `public/_headers`,
4. `ads.txt` in `public/`,
5. a consent management platform, before serving ads in the EU/UK.

Prerequisites still outstanding: a custom domain (AdSense does not accept
`*.pages.dev`, roughly $10–15/year), substantial content on each tool page, and
the legal pages fully written.

The legal pages currently describe the site as it actually is: no cookies, no
tracking, no personal data leaving the browser. They must be rewritten *before*
ads or any analytics with cookies are switched on, not after.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm run typecheck` | `astro check` — TypeScript and Astro diagnostics |
| `npm test` | Vitest over `src/lib/` |
| `npm run audit` | Skill audit script against `dist/` (build first) |

CI runs typecheck → test → build → audit on every pull request.

## Conventions specific to this repo

- The site's base URL comes from `PUBLIC_SITE_URL`. Never hardcode the domain:
  preview deployments must generate their own canonicals.
- Tool ids are stable and double as i18n namespaces (`targetRate.*`).
- Money is handled as numbers rounded at the display boundary. Any tool that
  starts accumulating rounding error should move to integer minor units.
