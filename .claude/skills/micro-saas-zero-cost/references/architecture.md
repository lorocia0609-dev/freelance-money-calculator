# Architecture and stack decisions

The reasoning behind the defaults in `SKILL.md`. Read this before proposing a
different stack, and cite it when recording a deviation.

## The shape of the system

```
Visitor ──> CDN edge (pre-built HTML/CSS/JS) ──> computation in the browser
                    ^
                    │ build
             GitHub Actions <── git push
```

There is no request-time server. Everything a visitor needs is produced at build
time and served as files. This is what makes hosting free at any traffic level a
small tool will realistically reach, and it removes an entire class of failure
(cold starts, timeouts, runaway bills from a traffic spike or a scraper).

## Why Astro

- **Zero JavaScript by default.** Pages ship as HTML unless a component is
  explicitly marked as an island. Most of a tool site — copy, FAQ, navigation,
  legal pages — needs no client JavaScript at all.
- **Islands architecture.** The interactive calculator hydrates on its own,
  independently of the rest of the page, so interactivity costs only what it uses.
- **i18n routing built in.** Locale prefixes, per-locale slugs and default-locale
  handling are framework features rather than a hand-rolled router.
- **Content collections.** Type-checked Markdown for guides and articles, which
  is how these sites acquire long-tail traffic, without a CMS or its bill.
- **Static output is the default mode**, not a special build flag that fights the
  framework.

### Alternatives considered

| Option | Why not |
|---|---|
| Next.js | Its strengths are SSR, ISR and route handlers — all things this architecture deliberately avoids. Larger baseline JS for the same static result. |
| React/Vue SPA (Vite) | Serves an empty HTML shell. Crawlers can render JS, but indexing is slower and less reliable, and the first paint is worse on the mobile devices that dominate this traffic. |
| SvelteKit | Capable and light, and a defensible choice. Astro wins on partial hydration and on i18n/content ergonomics for content-heavy sites. |
| Plain HTML + vanilla JS | Fine for one page. Two locales times ten tools is 20+ pages of duplicated `<head>`, navigation and footer — it decays fast. |
| WordPress | Needs paid hosting, is a security maintenance burden, and is heavy by default. |

## Why Preact for the islands

A calculator is a form with derived state — that needs a reactive component
model, but not a large one. Preact provides the hooks API in roughly 4 KB
gzipped. React itself costs about ten times that for identical behaviour here.

If a tool turns out to need no reactivity at all (a static reference table, a
converter driven purely by a `<select>`), skip the island and use plain HTML with
a few lines of inline script. Not every page needs a component.

## Why TypeScript, strictly

These products compute money, time and tax. The most common defect in this
domain is a unit error — monthly treated as annual, a percentage treated as a
fraction. Encode units in the type names (`annualNetIncomeCents`,
`taxRatePercent`) so the compiler catches what a reviewer will not.

Prefer integer minor units (cents) for currency, or round explicitly at the
boundary. Never let floating-point drift reach a displayed figure.

## Why state lives in the URL

Serializing inputs into the query string gives three things for free:

1. **Shareable results.** A user sends a link to a client or a forum, which
   creates inbound links and referral traffic — the growth channel this model
   depends on.
2. **No storage layer.** The URL *is* the persistence, so there is nothing to
   host, secure or pay for.
3. **Back-button semantics that match user expectation.**

Keep the parameters short and stable — they are a public interface. Validate and
clamp everything on read; a URL is untrusted input, and users edit them by hand.
Mirror the same state into `localStorage` so a returning visitor keeps their
inputs without needing the link.

## Where this architecture stops working

Be honest about the boundary rather than defending the pattern past its limits.
Move beyond static-only when the product genuinely requires:

- data that changes faster than the build cadence and cannot be fetched client-side,
- per-user records that must survive across devices,
- work that must stay secret from the client (proprietary models, licensed data),
- writes that require server-side authorization.

At that point the cheapest honest step is usually a single Cloudflare Worker,
which has a free tier — not a full backend. Discuss the tradeoff with the user
before building it, and record it in an ADR.
