/**
 * components/modals.js — project modal, task modal, task detail, comments.
 * Renders HTML into pre-existing overlay elements defined in index.html.
 */

import { S }                                   from '../state.js';
import { $, openModal, closeModal }            from '../utils/dom.js';
import { esc }                                 from '../utils/dom.js';
import { fmtDate, timeAgo, genId }             from '../utils/format.js';
import { avatarHTML, priColor }                from '../utils/avatar.js';
import { toast }                               from './toast.js';
import { saveProject }                         from '../services/projects.js';
import { createTask, updateTask, addComment }  from '../services/tasks.js';
import { aiGenerateDesc, aiSprintInsights }    from '../api/gemini.js';

// ── Project modal ────────────────────────────────────────────────────────────

/**
 * Open the project create/edit modal.
 * @param {object|null} project  null = create mode
 */
export function openProjectModal(project = null) {
  const isEdit = !!project;
  const overlay = $('proj-overlay');
  if (!overlay) return;

  // Populate workflow stages from org default or existing project
  const stages = project?.workflow
    ?? S.org?.workflow
    ?? ['To Do', 'In Progress', 'Done'];

  overlay.querySelector('#proj-modal-title').textContent = isEdit ? 'Edit Project' : 'New Project';
  overlay.querySelector('#proj-name').value        = project?.name        ?? '';
  overlay.querySelector('#proj-desc').value        = project?.description ?? '';
  overlay.querySelector('#proj-save-btn').textContent = isEdit ? 'Save Changes' : 'Create Project';
  overlay.dataset.editId = project?.id ?? '';

  renderWfTags(stages);
  openModal('proj-overlay');
}

function renderWfTags(stages) {
  const container = $('wf-tags-container');
  if (!container) return;
  container.innerHTML = stages.map((s, i) => `
    <span class="wf-tag" data-index="${i}">
      ${esc(s)}
      <button class="wf-rm" data-action="remove-stage" data-index="${i}" title="Remove stage">×</button>
    </span>`).join('');
}

export function getWorkflowStages() {
  return [...document.querySelectorAll('#wf-tags-container .wf-tag')]
    .map(el => el.childNodes[0].textContent.trim())
    .filter(Boolean);
}

// ── Task modal ───────────────────────────────────────────────────────────────

/**
 * Open the task create/edit modal.
 * @param {object|null} task      null = create mode
 * @param {string} [initialStage] default stage slug when creating
 */
export function openTaskModal(task = null, initialStage = null) {
  const overlay = $('task-overlay');
  if (!overlay) return;

  const isEdit = !!task;
  const workflow = S.currentProject?.workflow ?? ['To Do', 'In Progress', 'Done'];

  overlay.querySelector('#task-modal-title').textContent = isEdit ? 'Edit Task' : 'New Task';
  overlay.querySelector('#task-save-btn').textContent    = isEdit ? 'Save Changes' : 'Create Task';
  overlay.dataset.editId = task?.id ?? '';

  const titleEl = overlay.querySelector('#task-title');
  const descEl  = overlay.querySelector('#task-desc');
  const prioEl  = overlay.querySelector('#task-prio');
  const stageEl = overlay.querySelector('#task-stage');
  const dueDateEl = overlay.querySelector('#task-due');
  const assigneeEl = overlay.querySelector('#task-assignee');

  titleEl.value    = task?.title       ?? '';
  descEl.value     = task?.description ?? '';
  prioEl.value     = task?.priority    ?? 'medium';
  dueDateEl.value  = task?.dueDate     ?? '';

  // Populate stage select
  stageEl.innerHTML = workflow.map(s =>
    `<option value="${esc(s)}"${(task?.stage ?? initialStage ?? workflow[0]) === s ? ' selected' : ''}>${esc(s)}</option>`
  ).join('');

  // Populate assignee select
  assigneeEl.innerHTML = S.members.map(m =>
    `<option value="${esc(m.uid)}"${task?.assigneeId === m.uid ? ' selected' : ''}>${esc(m.displayName)}</option>`
  ).join('');

  openModal('task-overlay');
}

/**
 * Collect task form data and persist.
 * Called by event delegation in app.js.
 */
export async function saveTaskFromModal() {
  const overlay = $('task-overlay');
  if (!overlay) return;

  const title = overlay.querySelector('#task-title').value.trim();
  if (!title) {
    overlay.querySelector('#task-title').focus();
    return;
  }

  const editId     = overlay.dataset.editId;
  const stage      = overlay.querySelector('#task-stage').value;
  const assigneeId = overlay.querySelector('#task-assignee').value;
  const assignee   = S.members.find(m => m.uid === assigneeId);
  const workflow   = S.currentProject?.workflow ?? ['To Do', 'In Progress', 'Done'];
  const isLast     = stage === workflow[workflow.length - 1];

  const data = {
    title,
    description: overlay.querySelector('#task-desc').value.trim(),
    priority:    overlay.querySelector('#task-prio').value,
    stage,
    assigneeId,
    assigneeName: assignee?.displayName ?? '',
    dueDate:     overlay.querySelector('#task-due').value,
    isLastStage: isLast,
    projectId:   S.currentProject?.id,
  };

  if (editId) {
    await updateTask(S.currentProject.id, editId, data);
    toast('Task updated', 'success');
  } else {
    await createTask(S.currentProject.id, data);
    toast('Task created', 'success');
  }

  closeModal('task-overlay');
}

// ── Task detail modal ────────────────────────────────────────────────────────

/**
 * Open the task detail modal for a given task id.
 * @param {string} taskId
 */
export function openTaskDetail(taskId) {
  const tasks = S.tasks[S.currentProject?.id] ?? [];
  const task  = tasks.find(t => t.id === taskId);
  if (!task) return;

  S.currentTaskId = taskId;
  renderTaskDetail(task);
  openModal('detail-overlay');
}

export function renderTaskDetail(task) {
  const body = $('detail-body');
  if (!body) return;

  const workflow = S.currentProject?.workflow ?? [];
  const stageIdx = workflow.indexOf(task.stage);
  const assignee = S.members.find(m => m.uid === task.assigneeId);

  const stageColor = `var(--stage-${Math.max(0, stageIdx)})`;
  const pColor     = priColor(task.priority);

  const commentsHtml = renderComments(task.comments ?? []);

  body.innerHTML = `
    <div class="flex gap2" style="flex-wrap:wrap;margin-bottom:14px">
      <span class="chip" style="border-color:${stageColor};color:${stageColor}">${esc(task.stage)}</span>
      <span class="chip" style="border-color:${pColor};color:${pColor}">
        <span class="prio-dot prio-dot--${esc(task.priority)}"></span>${esc(task.priority)}
      </span>
      ${assignee ? `<span class="chip">${avatarHTML(assignee.displayName, 18, assignee.photoURL)} ${esc(assignee.displayName)}</span>` : ''}
      ${task.dueDate ? `<span class="chip">Due ${esc(task.dueDate)}</span>` : ''}
      <span class="chip">${timeAgo(task.createdAt)}</span>
    </div>

    <div style="background:var(--surface2);border-radius:var(--rs);padding:12px 14px;margin-bottom:18px;font-size:.875rem;line-height:1.6">
      ${task.description ? esc(task.description) : '<em style="color:var(--muted)">No description.</em>'}
    </div>

    <div style="margin-bottom:12px">
      <div class="flex gap2" style="margin-bottom:8px">
        <span style="font-weight:600;font-size:.85rem">Comments (${(task.comments ?? []).length})</span>
      </div>
      <div id="comments-list">${commentsHtml}</div>
      <div class="flex gap2" style="margin-top:12px;align-items:flex-end">
        <textarea id="cmt-input" placeholder="Write a comment…" rows="2" style="flex:1"></textarea>
        <button class="btn btn-primary btn-sm" data-action="post-comment">Post</button>
      </div>
    </div>

    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
      <button class="btn btn-secondary btn-sm" id="ai-desc-btn" data-action="ai-describe">
        ✨ AI Describe
      </button>
      <div id="ai-desc-result" style="display:none" class="ai-box"></div>
    </div>`;
}

/**
 * Build HTML for the comments list.
 * @param {Array} comments
 * @returns {string}
 */
export function renderComments(comments) {
  if (!comments || comments.length === 0)
    return `<p class="text-muted empty">No comments yet.</p>`;
  return comments.map(c => `
    <div class="comment">
      <div class="comment-meta">
        ${avatarHTML(c.authorName, 20)}
        <span class="comment-author">${esc(c.authorName)}</span>
        <span class="comment-time">${timeAgo(c.createdAt)}</span>
      </div>
      <p class="comment-text">${esc(c.text)}</p>
    </div>`).join('');
}

/**
 * Post a comment for the current detail task.
 * Called from app.js event delegation.
 */
export async function postComment() {
  const input = $('cmt-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const projectId = S.currentProject?.id;
  const taskId    = S.currentTaskId;
  if (!projectId || !taskId) return;

  const comment = {
    id:         genId(),
    text,
    authorId:   S.user.uid,
    authorName: S.profile?.displayName ?? S.user.email,
    createdAt:  Date.now(),
  };

  await addComment(projectId, taskId, comment);
  input.value = '';

  // Re-render comments section without closing modal
  const tasks = S.tasks[projectId] ?? [];
  const task  = tasks.find(t => t.id === taskId);
  if (task) {
    const list = $('comments-list');
    if (list) list.innerHTML = renderComments(task.comments ?? []);
  }
  toast('Comment posted', 'success');
}
