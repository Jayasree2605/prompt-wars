/**
 * utils/format.js — date formatting, time-ago, ID generation.
 */

/**
 * Generate a collision-resistant unique ID.
 * Prefers crypto.randomUUID when available.
 * @returns {string}
 */
export const genId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Format a timestamp (ms or Firestore Timestamp) as a local date string.
 * Returns empty string for null/undefined.
 * @param {number|{toMillis:Function}|null} ts
 * @returns {string}
 */
export function fmtDate(ts) {
  if (ts === null || ts === undefined) return '';
  const ms = typeof ts === 'object' && typeof ts.toMillis === 'function'
    ? ts.toMillis()
    : Number(ts);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/**
 * Return a relative time string — "just now", "3m ago", "2h ago", "5d ago".
 * @param {number} ts  Unix timestamp in ms
 * @returns {string}
 */
export function timeAgo(ts) {
  if (!ts) return '';
  const ms = typeof ts === 'object' && typeof ts.toMillis === 'function'
    ? ts.toMillis()
    : Number(ts);
  const m = Math.floor((Date.now() - ms) / 60_000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
