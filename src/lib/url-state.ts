/**
 * Tool state lives in the query string. That makes results shareable — which is
 * the site's cheapest growth channel — and removes any need for a storage layer.
 *
 * A URL is untrusted input that users edit by hand, so decoding always produces
 * a usable object rather than throwing: a malformed shared link must never
 * render a broken page.
 */
export type NumericState = Record<string, number>;

export function encodeState(state: NumericState): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (Number.isFinite(value)) params.set(key, String(value));
  }
  return params.toString();
}

export function decodeState<T extends NumericState>(search: string, defaults: T): T {
  const params = new URLSearchParams(search);
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const raw = params.get(String(key));
    if (raw === null) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) out[key] = parsed as T[keyof T];
  }
  return out;
}
