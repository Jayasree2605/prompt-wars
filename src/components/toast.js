/**
 * components/toast.js — toast notification helper.
 */

/**
 * Show a temporary toast notification.
 * @param {string} msg         Message text
 * @param {'info'|'success'|'warn'|'danger'} [type='info']
 * @param {number} [duration=3500]  ms before auto-dismiss
 */
export function toast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-wrap');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-wrap';
    container.className = 'toast-wrap';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = `toast${type !== 'info' ? ` toast--${type}` : ''}`;
  el.textContent = msg;
  container.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, duration);
}
