/**
 * views/kanban.js — Kanban board rendering, card building, drag-and-drop.
 * Reads from S.currentProject and S.tasks. Mutations done via updateTask called by app.js.
 */

import { S }              from '../state.js';
import { $, esc }         from '../utils/dom.js';
import { timeAgo }        from '../utils/format.js';
import { avatarHTML, priColor } from '../utils/avatar.js';

// stage colours cycle through CSS custom properties
const STAGE_COLORS = [
  'var(--stage-0)', 'var(--stage-1)', 'var(--stage-2)', 'var(--stage-3)',
  'var(--stage-4)', 'var(--stage-5)', 'var(--stage-6)', 'var(--stage-7)',
];

// drag state
let dragId      = null;
let dragSource  = null;

/**
 * Render the kanban board for the current project.
 * Creates one column per workflow stage.
 */
export function renderBoard() {
  const board = $('board');
  if (!board) return;

  const project = S.currentProject;
  if (!project) return;

  const workflow = project.workflow ?? ['To Do', 'In Progress', 'Done'];
  const tasks    = (S.tasks[project.id] ?? []);

  // Search filter
  const searchInput = $('kanban-search');
  const q = (searchInput?.value ?? '').toLowerCase();

  board.innerHTML = '';

  workflow.forEach((stage, idx) => {
    const color     = STAGE_COLORS[idx % STAGE_COLORS.length];
    const stageTasks = tasks.filter(t => {
      if (t.stage !== stage) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.assigneeName ?? '').toLowerCase().includes(q)
      );
    });

    const col = document.createElement('div');
    col.className = 'col';
    col.dataset.stage = stage;

    col.innerHTML = `
      <div class="col-hdr" style="border-top-color:${color}">
        <div class="col-title">
          <span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
          ${esc(stage)}
        </div>
        <span class="col-count">${stageTasks.length}</span>
      </div>
      <div class="col-body" data-stage="${esc(stage)}"
           id="col-body-${esc(stage).replace(/\s+/g,'-')}">
      </div>
      <div class="col-footer">
        <button class="add-card-btn" data-action="new-task" data-stage="${esc(stage)}">
          + Add a task
        </button>
      </div>`;

    const body = col.querySelector('.col-body');

    if (stageTasks.length === 0) {
      body.innerHTML = `<div class="empty" style="padding:16px 8px;font-size:.8rem">Drop tasks here</div>`;
    } else {
      stageTasks.forEach(task => body.appendChild(makeCard(task, workflow)));
    }

    // Drop zone listeners
    body.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.col-body.drag-over').forEach(el => el.classList.remove('drag-over'));
      body.classList.add('drag-over');
    });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', e => handleDrop(e, stage));

    board.appendChild(col);
  });
}

/**
 * Build a single task card element.
 * @param {object} task
 * @param {string[]} workflow
 * @returns {HTMLElement}
 */
export function makeCard(task, workflow) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.id = task.id;

  const pColor  = priColor(task.priority);
  const assignee = S.members.find(m => m.uid === task.assigneeId || m.id === task.assigneeId);
  const nComments = (task.comments ?? []).length;
  const isFirst = task.stage === workflow[0];
  const isLast  = task.stage === workflow[workflow.length - 1];

  card.innerHTML = `
    <div class="task-title">${esc(task.title)}</div>
    ${task.description
      ? `<p style="font-size:.78rem;color:var(--muted);margin:4px 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(task.description)}</p>`
      : ''}
    <div class="task-footer">
      <div class="flex gap2">
        ${assignee ? avatarHTML(assignee.displayName, 22, assignee.photoURL) : ''}
        <span style="font-size:.75rem;color:var(--muted)">${esc(assignee?.displayName ?? 'Unassigned')}</span>
      </div>
      <div class="flex gap2">
        <span class="prio-dot prio-dot--${esc(task.priority)}" style="background:${pColor}" title="${esc(task.priority)} priority"></span>
        ${nComments ? `<span style="font-size:.72rem;color:var(--muted)">💬${nComments}</span>` : ''}
        <span style="font-size:.72rem;color:var(--muted)">${timeAgo(task.createdAt)}</span>
      </div>
    </div>
    <div class="flex gap2" style="margin-top:9px;padding-top:8px;border-top:1px solid var(--border)">
      <button class="btn-icon" data-action="open-task-detail" data-id="${esc(task.id)}" title="View detail">💬</button>
      <button class="btn-icon" data-action="edit-task" data-id="${esc(task.id)}" title="Edit">✏️</button>
      <button class="btn-icon btn-icon--del" data-action="delete-task" data-id="${esc(task.id)}" title="Delete">🗑</button>
      <div class="flex gap2" style="margin-left:auto">
        <button class="btn btn-secondary btn-sm" data-action="move-task" data-id="${esc(task.id)}" data-dir="-1"
                ${isFirst ? 'disabled' : ''}>◀</button>
        <button class="btn btn-secondary btn-sm" data-action="move-task" data-id="${esc(task.id)}" data-dir="1"
                ${isLast ? 'disabled' : ''}>▶</button>
      </div>
    </div>`;

  card.addEventListener('dragstart', e => {
    dragId     = task.id;
    dragSource = task.stage;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.col-body.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  return card;
}

/**
 * Handle a drop event on a column body.
 * Returns the drag data to app.js via a custom event.
 * @param {DragEvent} e
 * @param {string} targetStage
 */
function handleDrop(e, targetStage) {
  e.preventDefault();
  document.querySelectorAll('.col-body.drag-over').forEach(el => el.classList.remove('drag-over'));

  if (!dragId || targetStage === dragSource) {
    dragId = null;
    return;
  }

  // Fire a custom event that app.js listens for and calls updateTask
  document.dispatchEvent(new CustomEvent('kanban:drop', {
    detail: { taskId: dragId, fromStage: dragSource, toStage: targetStage },
  }));

  dragId     = null;
  dragSource = null;
}
