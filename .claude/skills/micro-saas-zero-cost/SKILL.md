---
name: micro-saas-zero-cost
description: >
  Build and ship zero-cost, SEO-first micro-SaaS web tools — calculators,
  generators, converters, estimators — as static sites that launch for $0 and
  are ready for ad monetization later without a rebuild. Use this skill whenever
  the user starts a small web tool or utility site that must run with no backend,
  no database, no authentication and no paid APIs; whenever they add another
  calculator or tool to such a project; and whenever they work on its project
  structure, SEO metadata, structured data, EN/ES internationalization, Core Web
  Vitals, accessibility, AdSense readiness, or Cloudflare Pages deployment. Use
  it even when the user does not say "micro-SaaS" — phrases like "a simple free
  tool", "a calculator site", "a static site I can monetize with ads later",
  "something I can launch without paying for hosting", or "add another
  calculator" all fall squarely in scope.
---

# Zero-Cost Micro-SaaS Web Tools

A playbook for shipping small, single-purpose web tools that cost nothing to
run, rank well in search, and can carry ads later without being rewritten.

The economics behind every rule here: these products earn through organic search
traffic and advertising. That means the search engine and the mobile visitor are
the real users, not just the person clicking buttons. Traffic is the revenue, page
speed is the conversion rate, and any monthly bill turns a hobby project into a
liability before it earns anything. Optimize accordingly.

## The ten principles

1. **$0 to launch and $0 to run.** No component may bill by usage, time or
   request. The only acceptable recurring cost is a custom domain, and only when
   monetization is actually being pursued (see `references/monetization-readiness.md`).
2. **Static output, always.** Every page is pre-rendered HTML. Crawlers index it
   without executing JavaScript, CDNs cache it for free, and there is no server
   to fail or to pay for.
3. **Business logic is separate from UI.** Calculations live in pure,
   framework-free modules under `src/lib/`. They take plain inputs and return
   plain outputs, import nothing from the UI layer, and are covered by tests.
   The rule that keeps this honest: if a function needs the DOM or a component
   to run, it is in the wrong place.
4. **Tests where correctness is the product.** A calculator that returns wrong
   numbers destroys the only asset the site has — trust. Test the logic modules
   thoroughly; do not chase coverage on presentational components.
5. **SEO is designed in, not added on.** Titles, descriptions, canonicals,
   hreflang, structured data and a sitemap exist from the first deployed page.
   Retrofitting these means re-indexing from zero.
6. **Mobile-first.** Most search traffic for utility tools is mobile. Design the
   narrow viewport first and treat the desktop layout as the enhancement.
7. **Core Web Vitals are a budget, not an aspiration.** Ads will later consume
   part of that budget, so the un-monetized site must be comfortably inside the
   thresholds in `references/performance-a11y.md`.
8. **Accessible by default.** Labelled inputs, keyboard operability, announced
   results, WCAG 2.1 AA contrast. This is both an obligation and an SEO asset —
   the semantics that assistive technology needs are the semantics crawlers read.
9. **Bilingual (EN/ES) from commit one.** Every user-facing string comes from a
   translation catalogue. Hardcoding English "for now" is the single most
   expensive shortcut available in this stack.
10. **Built for many tools, not one.** The structure must make the fifth tool
    cheaper to add than the second. Each tool is a new entry point for search
    traffic, so the marginal cost of adding one determines how fast the site can grow.

## Default stack

These defaults are chosen and settled — start from them rather than re-deriving
them. `references/architecture.md` records the reasoning and the alternatives
that were rejected.

| Concern | Default |
|---|---|
| Framework | Astro (static output, zero JS by default) |
| Interactivity | Preact islands, hydrated with `client:idle` or `client:visible` |
| Language | TypeScript in `strict` mode |
| Styling | Tailwind CSS |
| Tests | Vitest, targeting `src/lib/` |
| Hosting | Cloudflare Pages, connected to the GitHub repository |
| CI | GitHub Actions: typecheck, test, build, audit |
| Analytics | Cloudflare Web Analytics (free, cookieless) |

### Deviating from the defaults

Deviate when there is a technical reason, not a preference. A deviation is
legitimate when the default cannot meet a stated requirement — for example a
tool that genuinely needs canvas rendering or a heavy computation library that
only ships for a different runtime.

When you deviate, record it: add a short entry to `docs/adr/` stating what was
changed, what forced the change, and what it costs. Skipping that record is how
a codebase quietly loses its architecture. Never deviate in a way that
introduces a recurring bill without telling the user the amount first.

## Hard constraints

Do not add any of the following unless the user explicitly asks for it after
being told the cost, and an ADR records the decision:

- **Databases** of any kind. User state belongs in the URL query string (which
  doubles as a shareable permalink and a source of inbound links) and in
  `localStorage`. If it is worth persisting server-side, it is worth a
  conversation first.
- **Authentication.** A login wall in front of a tool destroys the organic
  traffic the business model depends on.
- **Server-side rendering, serverless functions, or any runtime backend.** They
  reintroduce the bill and the failure mode the architecture exists to avoid.
- **Third-party APIs**, paid or free. Free tiers develop pricing, rate limits and
  outages. Prefer computing locally or bundling static data at build time.
- **Heavy client dependencies.** Before adding a library, check its transferred
  size against the JS budget. Charting, date and form libraries are the usual
  offenders; a small hand-written component almost always wins here.

## Build order

The sequence matters because some decisions are cheap now and expensive later.
i18n and directory structure are the extreme cases: retrofitting either means
touching every file and, for i18n, re-earning every ranking.

1. **Scaffold** — framework, TypeScript, styling, directory skeleton, i18n
   routing and the translation catalogue, even if only one tool exists.
2. **Logic and tests** — the pure module plus its tests, before any UI. Writing
   the tests first forces the input and output shapes to be explicit.
3. **UI island** — the interactive component that calls the logic module.
4. **URL and storage state** — serialize inputs to the query string; restore
   from `localStorage`. This makes results shareable, which is free marketing.
5. **SEO layer** — metadata, canonical, hreflang, JSON-LD, sitemap, robots.
6. **Content** — explanatory copy, FAQ, and the legal pages, in both locales.
7. **CI and deployment** — the pipeline and the first production deploy.
8. **Audit** — run `scripts/audit.mjs` against the build and fix what it reports.

## Adding a tool to an existing project

This loop is the reason the structure exists. Keep it boring and repeatable:

1. `src/lib/tools/<tool-name>.ts` — the pure calculation and its types.
2. `src/lib/tools/<tool-name>.test.ts` — cases covering normal input, boundaries
   and nonsense input.
3. `src/components/tools/<ToolName>.tsx` — the island; it renders and delegates,
   it does not calculate.
4. Translation keys for every new string, in all locales.
5. One page per locale, with a slug written in that locale's language — the slug
   is a ranking signal, so `/es/calculadora-de-x/` rather than `/es/x-calculator/`.
6. Register the tool in the shared tools index so navigation, the sitemap and the
   "related tools" links pick it up automatically.
7. Add its FAQ entries and cross-links from related tools.
8. Run the tests and the audit script.

If any of these steps requires editing more than a couple of shared files, the
structure has drifted — fix the structure rather than working around it.

## Definition of done

A tool is not finished until all of these hold. Verify, do not assume:

- [ ] Logic module is pure, typed, and its tests pass.
- [ ] Page renders complete, meaningful HTML with JavaScript disabled.
- [ ] No user-facing string is hardcoded; every locale is complete.
- [ ] Localized slug per locale, with reciprocal `hreflang` and `x-default`.
- [ ] Unique title and meta description; canonical URL present.
- [ ] Valid JSON-LD (`WebApplication` and `FAQPage` where a FAQ exists).
- [ ] Page is listed in the sitemap.
- [ ] Total JavaScript stays within the budget in `references/performance-a11y.md`.
- [ ] Fully keyboard operable; inputs labelled; results announced via a live region.
- [ ] Contrast meets WCAG AA in both light and dark themes.
- [ ] Ad slots reserve fixed space so enabling ads cannot shift layout.
- [ ] Legal pages exist in every locale.
- [ ] `node scripts/audit.mjs` (from the skill) reports no failures.

## Anti-patterns

Each of these has a specific cost, which is why it is worth naming:

- **Strings hardcoded in components.** Converting later touches every file and
  invariably misses some.
- **Ad slots without reserved height.** Enabling ads then shifts the layout,
  wrecks CLS, and hurts both rankings and ad revenue at once.
- **Calculation inside the component.** Untestable, unreusable, and it silently
  couples business rules to a rendering framework.
- **Untranslated slugs.** The non-default locale never ranks for its own market.
- **Hydrating the whole page.** Islands exist so that only the interactive part
  ships JavaScript; `client:load` on a wrapper defeats the entire architecture.
- **A single shared "all tools" translation blob.** It grows without bound and
  makes every tool depend on every other; namespace keys per tool instead.
- **Adding a dependency to save twenty lines.** The transfer cost is paid by every
  visitor on every page, forever.
- **Deferring the legal pages.** They are an approval prerequisite for ad
  networks, and writing them under deadline pressure produces worse ones.

## Where to look next

Read these when the task touches the area — they carry the detail that does not
belong in this file:

| File | Read it when |
|---|---|
| `references/architecture.md` | Choosing or questioning the stack; recording a deviation |
| `references/project-structure.md` | Scaffolding, or adding a tool or module |
| `references/seo.md` | Metadata, structured data, sitemap, slugs, content |
| `references/i18n.md` | Routing, translations, currency and number formatting |
| `references/performance-a11y.md` | Budgets, hydration strategy, accessibility review |
| `references/monetization-readiness.md` | Ad slots, consent, legal pages, AdSense prerequisites |
| `references/deployment.md` | Cloudflare Pages setup, CI pipeline, post-deploy checks |

## Bundled resources

`assets/templates/` holds starting points to copy and adapt rather than write
from memory: `tool-logic.ts`, `tool-logic.test.ts`, `ToolPage.astro`,
`Seo.astro`, `AdSlot.astro`, `ci.yml`.

`scripts/audit.mjs` audits a built static site against these principles —
metadata, hreflang reciprocity, structured data validity, JavaScript budget,
image alt text, ad-slot reservation and legal pages. It has no dependencies and
runs on the build output:

```bash
node .claude/skills/micro-saas-zero-cost/scripts/audit.mjs --dist dist --locales en,es
```

Wire it into CI once the site builds, so regressions surface in pull requests
rather than in Search Console weeks later.

## Project-specific decisions

This skill stays deliberately product-agnostic so it can be reused across
projects. Anything specific to one product — its name, domain, default currency,
which tools it ships, its content calendar — belongs in that repository's
`CLAUDE.md`, not here. When a project convention conflicts with this skill, the
project's `CLAUDE.md` wins; if the conflict looks like a genuine improvement,
raise it so the skill can be updated deliberately.
