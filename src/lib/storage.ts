/**
 * localStorage access, guarded. Private browsing modes and blocked-cookie
 * settings make these calls throw, and a returning visitor keeping their inputs
 * is a convenience — it must never be able to break the page.
 */
export function readStored<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage unavailable — inputs simply are not remembered. */
  }
}
