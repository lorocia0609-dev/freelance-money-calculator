/**
 * Deployment-wide switches, read from the environment at build time.
 */

/**
 * Whether this deployment may be indexed by search engines.
 *
 * Defaults to false when unset, and that direction is deliberate. Indexing a
 * temporary hostname is expensive to undo: the URLs enter the index, and when
 * the real domain arrives they compete with it as duplicates until the
 * redirects and canonicals are re-crawled. Failing to index a production
 * deployment, by contrast, is visible immediately and fixed by setting one
 * variable. The cheap failure is the safe default.
 */
export const INDEXABLE = import.meta.env.PUBLIC_INDEXABLE === 'true';

/** Ads stay off until the prerequisites in CLAUDE.md are met. */
export const ADS_ENABLED = import.meta.env.PUBLIC_ADS_ENABLED === 'true';
