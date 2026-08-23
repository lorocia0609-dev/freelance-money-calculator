# Technical SEO

Search traffic is the entire distribution channel for these products. Everything
below is a launch requirement, not an optimization pass.

## Per-page requirements

Every indexable page carries:

- **A unique `<title>`**, roughly 50–60 characters, leading with the term people
  actually search for. "Freelance Hourly Rate Calculator" beats "Home | Brand".
- **A unique meta description**, 140–160 characters. It rarely affects ranking
  directly but it drives click-through, which does.
- **A self-referencing `<link rel="canonical">`** with the absolute URL. Query
  strings carrying tool state create infinite URL variants; the canonical points
  them all at the clean URL so ranking signals consolidate on one page.
- **Reciprocal `hreflang` links** for every locale plus `x-default`.
- **`<html lang="...">`** matching the page locale.
- **Exactly one `<h1>`**, describing the page rather than the brand.
- **Open Graph and Twitter tags** so shared links render as cards.

Centralize all of this in a single `Seo.astro` component. Prop-driven metadata is
how you avoid a page shipping with a duplicated title six months from now.

## Structured data

Emit JSON-LD in `<script type="application/ld+json">`. It is how a tool page
earns rich results, and FAQ markup in particular consumes extra space in the SERP.

- **`WebApplication`** on every tool page: `name`, `applicationCategory`,
  `operatingSystem: "Any"`, `url`, `inLanguage`, and an `offers` block with
  `price: "0"` — free tools should say so in the markup.
- **`FAQPage`** where the page has a visible FAQ. The markup must match the
  visible text exactly; mismatches are a manual-action risk.
- **`BreadcrumbList`** matching the visible breadcrumb trail.
- **`Article`** on blog and guide pages, with real `datePublished` and
  `dateModified` values.

Validate the output — invalid JSON-LD is silently ignored, so it fails without
any visible symptom. The bundled audit script parses every block on every page.

## Sitemap and robots

- Generate `sitemap.xml` at build time from the routes, including every locale
  variant with `xhtml:link` alternates.
- `robots.txt` must reference the sitemap by absolute URL.
- Never let staging or preview deployments get indexed. Cloudflare Pages preview
  URLs should send `X-Robots-Tag: noindex` via `_headers`; duplicate content on a
  preview domain competes with production.

## URLs and slugs

- Localized, descriptive, hyphenated, lowercase, no dates, no ids.
- One concept per URL: `/en/freelance-hourly-rate-calculator/`.
- Trailing-slash behaviour must be consistent site-wide; pick one and enforce it
  with a redirect, since both forms indexing separately splits ranking signals.
- Treat published slugs as permanent. If one must change, ship a 301 redirect in
  the same commit.

## Content depth

A bare calculator is a thin page, and thin pages neither rank nor get approved by
ad networks. Each tool page needs, below the tool itself:

- an explanation of what it computes and the formula it uses,
- when the result applies and when it misleads,
- 4–8 FAQ entries drawn from real search phrasing,
- worked examples with concrete numbers,
- links to related tools and guides.

Aim for 600–1200 words of genuinely useful copy per tool page — written for the
person who just used the tool and now has a follow-up question, not padded for
word count. Write it in both locales; a machine-translated wall of text is worse
than a shorter, well-written one.

## Internal linking

Every tool links to its related tools, every guide links to the tool it explains,
and the homepage indexes everything. This spreads authority across new pages and
is the cheapest ranking lever available in a small site.

## Verification after deploy

1. `sitemap.xml` and `robots.txt` resolve on the production domain.
2. Google Rich Results Test passes on one tool page per locale.
3. `view-source` shows the full content — if the copy only appears after JS runs,
   the architecture has been violated somewhere.
4. Search Console: both locales submitted, sitemap accepted, no coverage errors.
