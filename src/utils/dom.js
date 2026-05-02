/**
 * utils/dom.js — DOM helpers, escape, debounce, screen/view/modal management.
 */

/** Shorthand for document.getElementById. */
export const $ = id => document.getElementById(id);

/**
 * Escape HTML special characters to prevent XSS.
 * Handles null/undefined gracefully.
 */
export const esc = s => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Debounce a function — delays execution until after `wait` ms of silence.
 * @param {Function} fn
 * @param {number} wait  milliseconds
 * @returns {Function}
 */
export const debounce = (fn, wait) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

// ── screen management ────────────────────────────────────────────────────────

/**
 * Show a single screen by id; hide all others.
 * Screens use class "screen" and get "active" when shown.
 * @param {string} screenId
 */
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.toggle('active', el.id === screenId);
  });

  // Special: #app is not a .screen but needs to be shown/hidden
  const app = $('app');
  if (app) app.classList.toggle('active', screenId === 'app');
}

// ── view management (within #app) ───────────────────────────────────────────

/**
 * Show a view inside the app by data-view attribute; update nav-btn states.
 * @param {string} viewName  e.g. 'projects', 'kanban', 'dashboard', 'admin'
 */
export function showView(viewName) {
  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewName);
  });
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
}

// ── modal management ─────────────────────────────────────────────────────────

/**
 * Open a modal overlay by id.
 * @param {string} overlayId
 */
export function openModal(overlayId) {
  const el = $(overlayId);
  if (!el) return;
  el.classList.add('open');
  // Focus the first focusable element inside the modal
  requestAnimationFrame(() => {
    const focusable = el.querySelector('input, textarea, select, button:not([disabled])');
    if (focusable) focusable.focus();
  });
}

/**
 * Close a modal overlay by id.
 * @param {string} overlayId
 */
export function closeModal(overlayId) {
  const el = $(overlayId);
  if (!el) return;
  el.classList.remove('open');
}

/**
 * Close all open modals.
 */
export function closeAllModals() {
  document.querySelectorAll('.overlay.open').forEach(el => el.classList.remove('open'));
}
