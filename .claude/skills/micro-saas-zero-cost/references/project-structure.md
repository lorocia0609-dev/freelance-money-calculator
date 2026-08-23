# Project structure

The layout exists to make the fifth tool cheaper to add than the second. If
adding a tool means editing many shared files, the structure has drifted.

## Layout

```
src/
  lib/                      # Pure logic. No framework imports. Fully testable.
    tools/
      <tool-name>.ts        # Calculation + input/output types
      <tool-name>.test.ts
    format.ts               # Intl-based number, currency and date formatting
    url-state.ts            # Query-string encode/decode with validation
    storage.ts              # localStorage access, guarded for privacy modes
    registry.ts             # Tool metadata: ids, slugs per locale, categories
  components/
    ui/                     # Presentational primitives: Field, Card, Tooltip
    tools/                  # One island per tool
    seo/                    # Seo.astro, JsonLd.astro, HrefLang.astro
    ads/                    # AdSlot.astro — space reserved, disabled by default
  layouts/
    BaseLayout.astro        # html/head/body, header, footer, analytics
    ToolLayout.astro        # Shared tool page furniture: hero, FAQ, related, ads
  i18n/
    en.json  es.json        # Namespaced by tool id
    utils.ts                # Locale detection, key lookup, route helpers
  content/
    blog/en/  blog/es/      # Markdown guides
  pages/
    <locale>/<localized-slug>/index.astro
    <locale>/{privacy,terms,cookies,about,contact}.astro
public/                     # robots.txt, favicons, static assets
docs/adr/                   # One short file per architectural deviation
```

## Module boundaries

The dependency direction is one-way, and keeping it that way is what makes the
logic reusable and the tests fast:

```
pages ──> layouts ──> components ──> lib
```

- `lib/` imports nothing from `components/`, `layouts/` or `pages/`, and nothing
  from the UI framework. A logic module should run unchanged in Node with no DOM.
- `components/` never contains business rules. If a component computes something
  a user would recognize as part of the product's value, that belongs in `lib/`.
- Formatting is not calculation. `lib/format.ts` turns numbers into locale-aware
  strings; the tool modules return raw numbers and never pre-formatted text.

## The tool registry

`lib/registry.ts` is the single source of truth for what exists:

```ts
export interface ToolMeta {
  id: string;                          // stable key, also the i18n namespace
  slugs: Record<Locale, string>;       // localized, one per locale
  category: string;
  related: string[];                   // ids, for cross-linking
}
```

Navigation, the sitemap, breadcrumbs, "related tools" blocks and the homepage
index all read from it. That is what makes step 6 of the add-a-tool loop a
one-line change instead of a hunt through the codebase.

## Naming

- Files in `lib/` and slugs: `kebab-case`.
- Components: `PascalCase`.
- i18n keys: `<toolId>.<section>.<key>` — namespacing per tool keeps catalogues
  from turning into one shared blob every tool depends on.
- Tool ids never change once published. Slugs may change, but each change costs a
  redirect and a temporary ranking dip, so choose them with care the first time.

## Tests

Test `lib/` and skip presentational components. For each tool cover: a
representative case with known-good expected output, boundary values (zero,
maximum, empty), invalid input handling, and any rounding rule that affects a
displayed figure. Where a formula comes from a public source, cite it in a
comment — future maintainers will need to verify it.
