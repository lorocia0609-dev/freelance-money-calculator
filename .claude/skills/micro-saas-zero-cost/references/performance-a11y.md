# Performance and accessibility

Two concerns, one section, because in this stack they are enforced by the same
habits: send less, mark it up correctly, and let the browser do its job.

## Budgets

Treat these as build-time limits, not goals. Ads are added later and will consume
part of the headroom, so an un-monetized page sitting exactly on the threshold is
already over budget.

| Metric | Target before ads |
|---|---|
| Largest Contentful Paint | < 1.8 s on mobile 4G |
| Interaction to Next Paint | < 150 ms |
| Cumulative Layout Shift | < 0.05 |
| Total JS transferred per page | < 60 KB compressed |
| Total CSS transferred per page | < 20 KB compressed |
| Lighthouse mobile performance | >= 95 |

## How to stay inside them

- **Hydrate the minimum.** `client:visible` for a calculator below the fold,
  `client:idle` for one above it. Reach for `client:load` only when the component
  must be interactive in the first paint — it is rarely true and always costs.
- **No web fonts until they earn their place.** A system font stack costs zero
  bytes and zero layout shift. If a brand font is required, self-host a subset,
  preload it, and use `font-display: swap`.
- **Images**: modern formats, explicit `width` and `height` (this alone prevents
  most CLS), `loading="lazy"` below the fold, and never a hero image where a
  heading would do.
- **No client-side routing.** Static pages served from an edge CDN are already
  fast; a router adds JavaScript to reimplement what the browser does natively.
- **Reserve space for anything that arrives late** — ads, embeds, async content.
  Space reserved up front cannot shift the layout later.
- **Third-party scripts are the usual regression.** Each one is a request, a
  parse cost and a privacy consideration. Cookieless analytics is the only one
  that belongs here before monetization.

## Accessibility

WCAG 2.1 AA. Beyond the obligation, the semantics assistive technology relies on
are the same ones crawlers read, so this work pays twice.

### Forms

- Every input has a real `<label for>`. Placeholders are not labels — they vanish
  on focus and fail contrast in most designs.
- Help text is linked with `aria-describedby`, including the units and range a
  field expects.
- Numeric inputs use `inputmode="decimal"` so mobile keyboards are usable.
- Validation messages are text next to the field, not colour alone, and are
  associated with it programmatically.

### Results

- Wrap the results region in `aria-live="polite"` so recalculations are announced
  without stealing focus. A silently-updating result is invisible to a screen
  reader user — and the result is the entire product.
- Never convey meaning by colour alone. Pair every colour cue with text or an icon.
- The headline figure should be reachable and readable as text, not baked into an
  image or canvas.

### Navigation and structure

- Logical heading hierarchy, one `h1` per page, no levels skipped.
- Visible focus indicators; never `outline: none` without a replacement.
- Full keyboard operability, in a tab order that matches the visual order.
- A skip link to the main content.
- Contrast >= 4.5:1 for body text and >= 3:1 for large text, verified in **both**
  themes — dark mode is where contrast failures usually hide.
- Honour `prefers-reduced-motion` for any transition or animation.

### Verification

Automated tooling catches roughly a third of real issues, so combine:

1. Lighthouse accessibility audit in CI.
2. A keyboard-only pass through the whole tool flow — enter values, read results,
   switch language, with no mouse.
3. One screen-reader pass per tool, confirming the result is announced.
