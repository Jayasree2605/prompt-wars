/**
 * utils/avatar.js — avatar background colour, initials, priority colour.
 */

const PALETTE = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4',
  '#84cc16', '#f97316',
];

/**
 * Deterministic background colour for a given name string.
 * @param {string} name
 * @returns {string}  hex colour
 */
export function avatarBg(name) {
  if (!name) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Up-to-two-letter initials from a full name.
 * Handles empty / single-word names gracefully.
 * @param {string} name
 * @returns {string}
 */
export function initials(name) {
  if (!name || typeof name !== 'string') return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Return a CSS colour string for a priority level.
 * @param {'high'|'medium'|'low'} priority
 * @returns {string}
 */
export function priColor(priority) {
  const map = {
    high:   '#ef4444',
    medium: '#f59e0b',
    low:    '#10b981',
  };
  return map[priority] ?? '#94a3b8';
}

/**
 * Build an avatar HTML string (img or initials div).
 * @param {string} name
 * @param {number} size   px
 * @param {string} [photoURL]
 * @returns {string}
 */
export function avatarHTML(name, size = 28, photoURL = '') {
  const bg   = avatarBg(name);
  const init = initials(name);
  if (photoURL) {
    return `<img class="avatar"
               src="${photoURL}"
               style="width:${size}px;height:${size}px;object-fit:cover"
               alt="${init}"
               aria-hidden="true" />`;
  }
  return `<div class="avatar"
               style="background:${bg};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px"
               aria-hidden="true">${init}</div>`;
}
