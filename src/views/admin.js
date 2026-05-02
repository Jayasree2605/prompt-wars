/**
 * views/admin.js — admin panel: member list with role management.
 */

import { S }              from '../state.js';
import { $, esc }         from '../utils/dom.js';
import { avatarHTML }     from '../utils/avatar.js';
import { toast }          from '../components/toast.js';
import { db }             from '../firebase.js';
import {
  doc, updateDoc,
}                          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const ROLES = ['employee', 'manager', 'ceo'];

/**
 * Render the admin members table.
 */
export function renderAdmin() {
  const tbody = $('admin-tbody');
  if (!tbody) return;

  if (!S.members.length) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="empty">No members yet. Share your Org ID to invite people.</td></tr>`;
    return;
  }

  const isCeo = S.profile?.role === 'ceo';

  tbody.innerHTML = S.members.map(m => {
    const uid     = m.uid ?? m.id;
    const isSelf  = uid === S.user?.uid;
    const roleOpts = ROLES.map(r =>
      `<option value="${r}"${m.role === r ? ' selected' : ''}>${r}</option>`
    ).join('');

    return `
      <tr>
        <td>
          <div class="flex gap2">
            ${avatarHTML(m.displayName, 28, m.photoURL)}
            <div>
              <div style="font-weight:500;font-size:.875rem">${esc(m.displayName)}</div>
              <div class="text-muted">${esc(m.email)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="role-badge role-badge--${esc(m.role)}">${esc(m.role)}</span>
        </td>
        <td>
          ${isCeo && !isSelf
            ? `<select class="role-select" data-uid="${esc(uid)}"
                       data-action="change-role" style="width:auto">
                 ${roleOpts}
               </select>`
            : `<span class="text-muted">${isSelf ? 'You' : '—'}</span>`}
        </td>
        <td>
          ${isCeo && !isSelf
            ? `<button class="btn btn-danger btn-sm" data-action="remove-member"
                       data-uid="${esc(uid)}">Remove</button>`
            : ''}
        </td>
      </tr>`;
  }).join('');

  // Display org invite code
  const orgCodeEl = $('org-id-display');
  if (orgCodeEl) orgCodeEl.textContent = S.org?.id ?? '';
}

/**
 * Change a member's role. Called by event delegation in app.js.
 * @param {string} uid
 * @param {string} newRole
 */
export async function changeRole(uid, newRole) {
  if (S.profile?.role !== 'ceo') {
    toast('Only CEOs can change roles', 'warn');
    return;
  }
  if (!ROLES.includes(newRole)) return;

  try {
    await updateDoc(doc(db, 'profiles', uid), { role: newRole });
    const member = S.members.find(m => (m.uid ?? m.id) === uid);
    if (member) member.role = newRole;
    renderAdmin();
    toast('Role updated', 'success');
  } catch (err) {
    console.error('[admin] changeRole', err);
    toast('Failed to update role', 'danger');
  }
}

/**
 * Remove a member from the org (sets orgId to null).
 * @param {string} uid
 */
export async function removeMember(uid) {
  if (S.profile?.role !== 'ceo') return;
  if (!confirm('Remove this member from the org?')) return;

  try {
    await updateDoc(doc(db, 'profiles', uid), { orgId: null, role: 'employee' });
    S.members = S.members.filter(m => (m.uid ?? m.id) !== uid);
    renderAdmin();
    toast('Member removed', 'success');
  } catch (err) {
    console.error('[admin] removeMember', err);
    toast('Failed to remove member', 'danger');
  }
}
