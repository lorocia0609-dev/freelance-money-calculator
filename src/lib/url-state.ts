/**
 * Tool state lives in the query string. That makes a result shareable — the
 * site's cheapest growth channel — and removes any need for a storage layer.
 *
 * Two rules shape this module:
 *
 * 1. A URL is untrusted input that people edit by hand and that survives for
 *    years in bookmarks and messages. Decoding therefore never throws: it
 *    reports what it could read and lets the caller fill the rest in with
 *    defaults, so a malformed link renders a working page rather than a broken one.
 * 2. Parameter names are a public interface. Once a link is shared, the name is
 *    permanent — renaming one silently changes what an old link means. Each tool
 *    declares its own alias map and treats it as frozen.
 */

/** Maps a tool's field names to the short names used in the query string. */
export type ParamAliases<T> = { readonly [K in keyof T]: string };

/**
 * Writes every finite value. Values equal to a default are written too, on
 * purpose: an omitted parameter would be re-read as whatever the default happens
 * to be at that moment, so a link shared today would quietly change meaning if a
 * default were ever adjusted.
 */
export function encodeNumericState<T extends Record<keyof T, number>>(
  state: T,
  aliases: ParamAliases<T>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(aliases) as (keyof T)[]) {
    const value = state[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      params.set(aliases[key], String(value));
    }
  }
  return params;
}

/**
 * Reads whatever is present and valid, and reports nothing for the rest.
 *
 * Returning a partial rather than a filled object keeps the defaulting and
 * clamping rules in one place — the tool's own normalize function — instead of
 * duplicating them here.
 */
export function decodeNumericState<T extends Record<keyof T, number>>(
  search: string,
  aliases: ParamAliases<T>,
): Partial<Record<keyof T, number>> {
  const params = new URLSearchParams(search);
  const out: Partial<Record<keyof T, number>> = {};

  for (const key of Object.keys(aliases) as (keyof T)[]) {
    const raw = params.get(aliases[key]);
    if (raw === null || raw.trim() === '') continue;
    const parsed = Number(raw);
    // Anything unparseable — text, an injected payload, an empty value — is
    // simply not reported, and the caller's default takes over.
    if (Number.isFinite(parsed)) out[key] = parsed;
  }
  return out;
}

/** True when the query string carries at least one parameter this tool owns. */
export function hasAnyParam<T extends Record<keyof T, number>>(
  search: string,
  aliases: ParamAliases<T>,
): boolean {
  const params = new URLSearchParams(search);
  return Object.values(aliases).some((alias) => params.has(alias as string));
}

/**
 * Reads a parameter constrained to a known set, such as a currency code.
 * An unrecognized value falls back rather than propagating into formatting,
 * where an invalid ISO code would make Intl throw.
 */
export function readEnumParam<T extends string>(
  search: string,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = new URLSearchParams(search).get(key);
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}
