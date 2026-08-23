#!/usr/bin/env node
/**
 * Zero-cost micro-SaaS build audit.
 *
 * Audits a built static site against the principles in SKILL.md: metadata,
 * hreflang reciprocity, structured-data validity, JavaScript budget, image alt
 * text, ad-slot space reservation and legal pages.
 *
 * It runs on the build output rather than the source, because these are
 * properties of what actually gets served — a component can look correct and
 * still emit a relative hreflang or a duplicated title.
 *
 * No dependencies: Node built-ins only, so it works in CI without an install
 * step and cannot itself become a maintenance cost.
 *
 * Usage:
 *   node audit.mjs --dist dist --locales en,es
 *   node audit.mjs --dist dist --js-budget-kb 60 --fail-on-warn
 *   node audit.mjs --dist dist --json
 *
 * Config file (optional): audit.config.json at the project root, same keys as
 * the CLI flags in camelCase.
 *
 * Exit codes: 0 = no failures, 1 = failures found, 2 = could not run.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ config */

const DEFAULTS = {
  dist: 'dist',
  locales: ['en'],
  jsBudgetKb: 60,
  cssBudgetKb: 20,
  legalSlugs: ['privacy', 'terms', 'cookies'],
  failOnWarn: false,
  json: false,
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

async function loadConfig() {
  const cli = parseArgs(process.argv.slice(2));
  let file = {};
  const configPath = path.resolve('audit.config.json');
  if (existsSync(configPath)) {
    try {
      file = JSON.parse(await readFile(configPath, 'utf8'));
    } catch {
      console.error('audit.config.json exists but is not valid JSON — ignoring it.');
    }
  }

  const list = (value) =>
    Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim()).filter(Boolean);

  return {
    dist: cli.dist ?? file.dist ?? DEFAULTS.dist,
    locales: cli.locales ? list(cli.locales) : file.locales ? list(file.locales) : DEFAULTS.locales,
    jsBudgetKb: Number(cli['js-budget-kb'] ?? file.jsBudgetKb ?? DEFAULTS.jsBudgetKb),
    cssBudgetKb: Number(cli['css-budget-kb'] ?? file.cssBudgetKb ?? DEFAULTS.cssBudgetKb),
    legalSlugs: cli['legal-slugs'] ? list(cli['legal-slugs']) : file.legalSlugs ? list(file.legalSlugs) : DEFAULTS.legalSlugs,
    failOnWarn: cli['fail-on-warn'] === true || file.failOnWarn === true,
    json: cli.json === true || file.json === true,
  };
}

/* ----------------------------------------------------------------- results */

const results = [];
const record = (status, check, detail, where) => results.push({ status, check, detail, where });
const pass = (check, detail, where) => record('pass', check, detail, where);
const warn = (check, detail, where) => record('warn', check, detail, where);
const fail = (check, detail, where) => record('fail', check, detail, where);

/* ------------------------------------------------------------------- utils */

function readTextSync(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

async function walk(dir, ext) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, ext)));
    else if (!ext || entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

async function totalBytes(files) {
  let sum = 0;
  for (const file of files) sum += (await stat(file)).size;
  return sum;
}

/** Route for an HTML file, e.g. dist/en/foo/index.html -> /en/foo/ */
function routeOf(file, dist) {
  const rel = path.relative(dist, file).split(path.sep).join('/');
  return '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '/');
}

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
};
const tags = (html, tagName) => html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];

/* ------------------------------------------------------------------ checks */

/**
 * A deployment where every page is noindex is a deliberate state, not a defect:
 * a live test on a temporary hostname, or a staging environment. Its
 * expectations are inverted — robots.txt should block, and a sitemap should be
 * absent — so auditing it against the indexable rules only produces noise.
 */
function checkSiteFiles(dist, indexable) {
  const robots = path.join(dist, 'robots.txt');
  const sitemapCandidates = ['sitemap.xml', 'sitemap-index.xml'].map((f) => path.join(dist, f));
  const sitemap = sitemapCandidates.find((f) => existsSync(f));

  if (!existsSync(robots)) {
    fail('robots.txt', 'Missing.', dist);
  } else {
    const content = readTextSync(robots);
    if (!indexable) {
      if (/disallow:\s*\/\s*$/im.test(content)) {
        pass('robots.txt', 'Blocks crawling, as a non-indexable deployment should.', robots);
      } else {
        fail('robots.txt', 'Every page is noindex but robots.txt does not disallow crawling.', robots);
      }
      if (/sitemap:/i.test(content)) {
        warn('robots.txt', 'Advertises a sitemap on a deployment that must not be crawled.', robots);
      }
    } else if (!/sitemap:\s*https?:\/\//i.test(content)) {
      warn('robots.txt', 'Does not reference the sitemap by absolute URL.', robots);
    } else {
      pass('robots.txt', 'Present and references the sitemap.', robots);
    }
  }

  if (!indexable) {
    if (sitemap) warn('sitemap', 'Published on a deployment where every page is noindex.', sitemap);
    else pass('sitemap', 'Absent, as a non-indexable deployment should be.', dist);
  } else if (!sitemap) {
    fail('sitemap', 'No sitemap.xml or sitemap-index.xml in the build output.', dist);
  } else {
    pass('sitemap', `Present (${path.basename(sitemap)}).`, sitemap);
  }

  return sitemap;
}

function checkPage(html, route, file, config, hreflangMap) {
  const where = route;

  // A meta-refresh stub (e.g. the root redirecting to the default locale) is not
  // a content page; auditing it as one produces noise, not findings.
  if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) {
    return { redirect: true };
  }

  // noindex pages are excluded from the index by design, so duplicate metadata
  // and hreflang membership are not defects there.
  const isNoindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);

  // <html lang>
  const htmlTag = tags(html, 'html')[0];
  const lang = htmlTag ? attr(htmlTag, 'lang') : null;
  if (!lang) fail('lang attribute', 'Missing <html lang>. Screen readers and search engines both need it.', where);

  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  if (!title) fail('title', 'Missing or empty <title>.', where);
  else if (title.length > 65) warn('title', `${title.length} chars — likely truncated in results.`, where);

  // Meta description
  const description = tags(html, 'meta')
    .filter((t) => (attr(t, 'name') ?? '').toLowerCase() === 'description')
    .map((t) => attr(t, 'content'))[0];
  if (!description) fail('meta description', 'Missing. Hurts click-through from search results.', where);
  else if (description.length < 50 || description.length > 165) {
    warn('meta description', `${description.length} chars — aim for 140-160.`, where);
  }

  // Canonical
  const canonical = tags(html, 'link')
    .filter((t) => (attr(t, 'rel') ?? '').toLowerCase() === 'canonical')
    .map((t) => attr(t, 'href'))[0];
  if (!canonical) {
    fail('canonical', 'Missing. Query-string variants will be indexed as duplicates.', where);
  } else if (!/^https?:\/\//i.test(canonical)) {
    fail('canonical', `Must be absolute, got "${canonical}".`, where);
  }

  // hreflang — collected here, reciprocity verified across all pages afterwards
  const alternates = tags(html, 'link')
    .filter((t) => (attr(t, 'rel') ?? '').toLowerCase() === 'alternate' && attr(t, 'hreflang'))
    .map((t) => ({ hreflang: attr(t, 'hreflang'), href: attr(t, 'href') }));

  if (config.locales.length > 1 && !isNoindex) {
    if (alternates.length === 0) {
      fail('hreflang', 'No alternates on a multilingual site.', where);
    } else {
      const relative = alternates.filter((a) => !/^https?:\/\//i.test(a.href ?? ''));
      if (relative.length) fail('hreflang', 'Alternate URLs must be absolute.', where);
      if (!alternates.some((a) => a.hreflang.toLowerCase() === 'x-default')) {
        warn('hreflang', 'No x-default alternate.', where);
      }
      hreflangMap.set(canonical ?? route, alternates);
    }
  }

  // Headings
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  if (h1Count === 0) fail('h1', 'Page has no <h1>.', where);
  else if (h1Count > 1) warn('h1', `${h1Count} <h1> elements — use exactly one.`, where);

  // JSON-LD validity — invalid blocks are ignored silently by search engines
  const ldBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of ldBlocks) {
    const body = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      JSON.parse(body);
    } catch (e) {
      fail('JSON-LD', `Invalid JSON in a structured-data block: ${e.message}`, where);
    }
  }
  if (ldBlocks.length === 0 && !isNoindex) warn('JSON-LD', 'No structured data on this page.', where);

  // Images without alt
  const imgs = tags(html, 'img');
  const noAlt = imgs.filter((t) => attr(t, 'alt') === null);
  if (noAlt.length) fail('image alt', `${noAlt.length} <img> without an alt attribute.`, where);

  // Images without explicit dimensions (CLS)
  const noDims = imgs.filter((t) => !(attr(t, 'width') && attr(t, 'height')) && !/style=["'][^"']*aspect-ratio/i.test(t));
  if (noDims.length) warn('image dimensions', `${noDims.length} <img> without width/height — CLS risk.`, where);

  // Ad slots must reserve space
  const adSlots = (html.match(/<[^>]*data-ad-slot[^>]*>/gi) ?? []);
  const unreserved = adSlots.filter((t) => !/(min-)?height\s*:/i.test(attr(t, 'style') ?? ''));
  if (unreserved.length) {
    fail('ad slot reservation', `${unreserved.length} ad slot(s) without a reserved height — enabling ads will shift the layout.`, where);
  }

  // Third-party scripts
  const externalScripts = tags(html, 'script')
    .map((t) => attr(t, 'src'))
    .filter((src) => src && /^https?:\/\//i.test(src));
  if (externalScripts.length) {
    warn('third-party scripts', `${externalScripts.length} external script(s): ${externalScripts.join(', ')}`, where);
  }

  return { title, description, canonical, lang, isNoindex, redirect: false };
}

function checkDuplicates(pages) {
  const byTitle = new Map();
  const byDescription = new Map();
  for (const [route, meta] of pages) {
    if (meta.redirect || meta.isNoindex) continue;
    if (meta.title) byTitle.set(meta.title, [...(byTitle.get(meta.title) ?? []), route]);
    if (meta.description) byDescription.set(meta.description, [...(byDescription.get(meta.description) ?? []), route]);
  }
  for (const [title, routes] of byTitle) {
    if (routes.length > 1) warn('duplicate title', `"${title.slice(0, 50)}..." on ${routes.length} pages`, routes.join(', '));
  }
  for (const [, routes] of byDescription) {
    if (routes.length > 1) warn('duplicate description', `Shared by ${routes.length} pages`, routes.join(', '));
  }
}

function checkHreflangReciprocity(hreflangMap) {
  // Non-reciprocal hreflang is ignored wholesale, so a one-way link is as bad as none.
  const declared = new Set(hreflangMap.keys());
  for (const [url, alternates] of hreflangMap) {
    for (const alt of alternates) {
      if (alt.hreflang.toLowerCase() === 'x-default') continue;
      if (!declared.has(alt.href)) continue; // target not in this build; cannot verify
      const back = hreflangMap.get(alt.href) ?? [];
      if (!back.some((a) => a.href === url)) {
        fail('hreflang reciprocity', `${alt.href} does not link back to ${url}.`, url);
      }
    }
  }
  if (hreflangMap.size > 1) {
    pass('hreflang reciprocity', `Verified across ${hreflangMap.size} pages.`, '');
  }
}

function checkLegalPages(routes, config) {
  for (const locale of config.locales) {
    for (const slug of config.legalSlugs) {
      const found = routes.some((r) => r.includes(`/${locale}/`) && r.includes(slug));
      if (!found) {
        warn('legal pages', `No "${slug}" page for locale "${locale}" — required before an ad network review.`, `/${locale}/`);
      }
    }
  }
}

async function checkBudgets(dist, config) {
  const js = await walk(dist, '.js');
  const css = await walk(dist, '.css');
  const jsKb = (await totalBytes(js)) / 1024;
  const cssKb = (await totalBytes(css)) / 1024;

  // Uncompressed bytes: roughly 3x the compressed transfer, so compare generously.
  const jsLimit = config.jsBudgetKb * 3;
  const cssLimit = config.cssBudgetKb * 3;

  if (jsKb > jsLimit) fail('JS budget', `${jsKb.toFixed(1)} KB uncompressed across ${js.length} files (limit ~${jsLimit} KB).`, dist);
  else pass('JS budget', `${jsKb.toFixed(1)} KB uncompressed across ${js.length} files.`, dist);

  if (cssKb > cssLimit) warn('CSS budget', `${cssKb.toFixed(1)} KB uncompressed (limit ~${cssLimit} KB).`, dist);
  else pass('CSS budget', `${cssKb.toFixed(1)} KB uncompressed.`, dist);
}

/* -------------------------------------------------------------------- main */

async function main() {
  const config = await loadConfig();
  const dist = path.resolve(config.dist);

  if (!existsSync(dist)) {
    console.error(`Build output not found at "${dist}". Run the production build first.`);
    process.exit(2);
  }

  const htmlFiles = await walk(dist, '.html');
  if (htmlFiles.length === 0) {
    console.error(`No HTML files under "${dist}". Is this the right output directory?`);
    process.exit(2);
  }

  // Determined before anything else, because it changes what "correct" means.
  const indexable = htmlFiles.some((file) => {
    const html = readTextSync(file);
    if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) return false;
    return !/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
  });

  if (!indexable) {
    pass('deployment mode', 'Every page is noindex — audited as a non-indexable deployment.', dist);
  }

  checkSiteFiles(dist, indexable);

  const pages = new Map();
  const hreflangMap = new Map();
  const routes = [];

  for (const file of htmlFiles) {
    const route = routeOf(file, dist);
    routes.push(route);
    const html = await readFile(file, 'utf8');
    pages.set(route, checkPage(html, route, file, config, hreflangMap));
  }

  checkDuplicates(pages);
  checkHreflangReciprocity(hreflangMap);
  checkLegalPages(routes, config);
  await checkBudgets(dist, config);

  report(results, config, htmlFiles.length);
}

function report(all, config, pageCount) {
  const failures = all.filter((r) => r.status === 'fail');
  const warnings = all.filter((r) => r.status === 'warn');
  const passes = all.filter((r) => r.status === 'pass');

  if (config.json) {
    console.log(JSON.stringify({ pageCount, failures, warnings, passes }, null, 2));
  } else {
    const icon = { fail: 'FAIL', warn: 'WARN', pass: 'PASS' };
    console.log(`\nZero-cost micro-SaaS audit — ${pageCount} page(s)\n`);
    for (const group of [failures, warnings]) {
      for (const r of group) {
        console.log(`  ${icon[r.status]}  ${r.check}: ${r.detail}`);
        if (r.where) console.log(`        ${r.where}`);
      }
    }
    for (const r of passes) console.log(`  ${icon[r.status]}  ${r.check}: ${r.detail}`);
    console.log(`\n  ${failures.length} failed · ${warnings.length} warnings · ${passes.length} passed\n`);
  }

  if (failures.length > 0 || (config.failOnWarn && warnings.length > 0)) process.exit(1);
  process.exit(0);
}

main().catch((error) => {
  console.error('Audit could not complete:', error);
  process.exit(2);
});
