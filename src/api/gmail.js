/**
 * api/gmail.js — send emails via Gmail API using GIS access token.
 */

import { ensureToken } from './gis.js';
import { toast }       from '../components/toast.js';

/**
 * Send an email via Gmail API.
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.body    plain-text body
 */
export async function sendEmail({ to, subject, body }) {
  if (!to || !subject) return;

  let token;
  try {
    token = await ensureToken();
  } catch {
    return; // token denied — already toasted
  }

  // Build RFC-2822 message
  const msg = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');

  const encoded = btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method:  'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
      }
    );
    if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  } catch (err) {
    console.error('[gmail] sendEmail failed', err);
  }
}

/**
 * Notify an assignee that a task has been assigned to them.
 * @param {object} task
 * @param {string} assigneeEmail
 */
export async function notifyAssigned(task, assigneeEmail) {
  if (!assigneeEmail) return;
  await sendEmail({
    to:      assigneeEmail,
    subject: `[TeamFlow] Task assigned: ${task.title}`,
    body: [
      `Hi,`,
      ``,
      `A task has been assigned to you in TeamFlow:`,
      ``,
      `  Title:    ${task.title}`,
      `  Project:  ${task.projectName ?? ''}`,
      `  Stage:    ${task.stage ?? ''}`,
      `  Priority: ${task.priority ?? ''}`,
      ``,
      task.description ? `Description:\n${task.description}\n` : '',
      `Please log in to TeamFlow to view the full details.`,
    ].join('\n'),
  });
}

/**
 * Notify a manager that a task has been completed.
 * @param {object} task
 * @param {string} managerEmail
 */
export async function notifyCompleted(task, managerEmail) {
  if (!managerEmail) return;
  await sendEmail({
    to:      managerEmail,
    subject: `[TeamFlow] Task completed: ${task.title}`,
    body: [
      `Hi,`,
      ``,
      `A task has been moved to the final stage in TeamFlow:`,
      ``,
      `  Title:    ${task.title}`,
      `  Project:  ${task.projectName ?? ''}`,
      `  Assignee: ${task.assigneeName ?? ''}`,
      ``,
      `Log in to TeamFlow to review.`,
    ].join('\n'),
  });
}
