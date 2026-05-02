/**
 * state.js — singleton application state + pub/sub
 * Single source of truth. No imports from other app modules.
 */

export const S = {
  user:           null,   // Firebase Auth user
  profile:        null,   // Firestore profile doc { displayName, email, role, orgId, photoURL }
  org:            null,   // Firestore org doc { id, name, domain, workflow: [] }
  members:        [],     // array of profile docs for current org
  projects:       [],     // array of project docs
  tasks:          {},     // tasks keyed by projectId  { [projectId]: task[] }
  currentProject: null,   // currently open project doc
  currentTaskId:  null,   // task detail modal open for this id
  calToken:       null,   // Google Calendar OAuth2 access token
  listeners:      [],     // firestore unsubscribe fns — call all on org switch / sign-out
};

// ── pub / sub ────────────────────────────────────────────────────────────────
const handlers = {};

/**
 * Subscribe to an event.
 * @param {string} event
 * @param {Function} fn
 */
export const on = (event, fn) => {
  (handlers[event] ??= []).push(fn);
};

/**
 * Emit an event to all subscribers.
 * @param {string} event
 * @param {*} data
 */
export const emit = (event, data) => {
  (handlers[event] ?? []).forEach(fn => {
    try { fn(data); } catch (err) { console.error(`[state] handler error for "${event}"`, err); }
  });
};

/**
 * Unsubscribe all active Firestore listeners and reset them.
 */
export function clearListeners() {
  S.listeners.forEach(unsub => { try { unsub(); } catch (_) {} });
  S.listeners = [];
}

/**
 * Reset volatile state on sign-out.
 */
export function resetState() {
  clearListeners();
  S.user           = null;
  S.profile        = null;
  S.org            = null;
  S.members        = [];
  S.projects       = [];
  S.tasks          = {};
  S.currentProject = null;
  S.currentTaskId  = null;
  S.calToken       = null;
}
