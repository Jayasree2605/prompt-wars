/**
 * app.js — entry point.
 * Wires auth, state events, event delegation, and view rendering.
 * NO inline handlers in HTML. All delegation goes through this file.
 */

import { S, on, emit, resetState }     from './state.js';
import { signIn, signOut, onAuthChange } from './auth.js';
import { $, showScreen, showView, openModal, closeModal, closeAllModals, esc } from './utils/dom.js';
import { debounce }                    from './utils/dom.js';
import { toast }                       from './components/toast.js';
import { initGIS }                     from './api/gis.js';
import { chatNotify }                  from './api/chat.js';
import { notifyAssigned, notifyCompleted } from './api/gmail.js';
import { aiGenerateDesc }              from './api/gemini.js';

import { loadOrg, createOrg, joinOrg } from './services/orgs.js';
import { subscribeProjects, saveProject } from './services/projects.js';
import { subscribeTasksForProject, createTask, updateTask, deleteTask } from './services/tasks.js';

import { renderProjects, openProject } from './views/projects.js';
import { renderBoard, makeCard }       from './views/kanban.js';
import { renderDashboard, loadSprintInsights } from './views/dashboard.js';
import { renderAdmin, changeRole, removeMember } from './views/admin.js';

import {
  openProjectModal, getWorkflowStages, openTaskModal, saveTaskFromModal,
  openTaskDetail, renderTaskDetail, renderComments, postComment,
} from './components/modals.js';

// ── Config validation ────────────────────────────────────────────────────────
function validateConfig() {
  const cfg = window.APP_CONFIG;
  if (!cfg) { console.error('[app] APP_CONFIG missing'); return; }

  const warnings = [];
  if (!cfg.firebase?.apiKey || cfg.firebase.apiKey.startsWith('YOUR_'))
    warnings.push('firebase.apiKey');
  if (!cfg.google?.clientId || cfg.google.clientId.startsWith('YOUR_'))
    warnings.push('google.clientId');
  if (!cfg.gemini?.apiKey || cfg.gemini.apiKey.startsWith('YOUR_'))
    warnings.push('gemini.apiKey');
  if (!cfg.googleChat?.webhookUrl || cfg.googleChat.webhookUrl.startsWith('YOUR_'))
    warnings.push('googleChat.webhookUrl');

  if (warnings.length)
    console.warn('[app] Unconfigured placeholders:', warnings.join(', '));
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function boot() {
  validateConfig();
  initGIS();
  wireEventDelegation();
  wireKeyboard();

  showScreen('login-screen');

  // Subscribe to pub/sub events
  on('projects:updated', renderProjects);
  on('tasks:updated',    ({ projectId } = {}) => {
    if (S.currentProject?.id === projectId) renderBoard();
  });
  on('auth:signedout', () => showScreen('login-screen'));

  // Auth observer
  onAuthChange(async profile => {
    if (!profile) { showScreen('login-screen'); return; }

    S.profile = profile;

    if (!profile.orgId) {
      showScreen('setup-screen');
      return;
    }

    try {
      await loadOrg(profile.orgId);
    } catch (err) {
      console.error('[app] loadOrg failed', err);
      toast('Failed to load organisation', 'danger');
      showScreen('setup-screen');
      return;
    }

    initApp();
  });
}

// ── App initialisation post-auth ─────────────────────────────────────────────
function initApp() {
  updateHeaderProfile();
  showScreen('app');
  showView('projects');
  subscribeProjects();
  emit('projects:updated', S.projects);
}

function updateHeaderProfile() {
  const nameEl  = $('header-user-name');
  const orgEl   = $('header-org-name');
  const avEl    = $('header-avatar');

  if (nameEl) nameEl.textContent = S.profile?.displayName ?? S.user?.email ?? '';
  if (orgEl)  orgEl.textContent  = S.org?.name ?? '';

  if (avEl && S.profile) {
    const { avatarHTML } = { avatarHTML: null }; // lazy import below
    import('./utils/avatar.js').then(({ avatarHTML }) => {
      if (avEl) avEl.innerHTML = avatarHTML(
        S.profile.displayName ?? '', 32, S.profile.photoURL ?? ''
      );
    });
  }
}

// ── Global event delegation ───────────────────────────────────────────────────
function wireEventDelegation() {
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('kanban:drop', handleKanbanDrop);
}

async function handleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id     = btn.dataset.id ?? btn.dataset.uid ?? '';
  const stage  = btn.dataset.stage ?? '';
  const dir    = parseInt(btn.dataset.dir ?? '0', 10);
  const modal  = btn.dataset.modal ?? '';
  const view   = btn.dataset.view  ?? '';

  switch (action) {

    // ── Auth
    case 'signin':
      try { await signIn(); }
      catch (err) { toast('Sign-in failed: ' + err.message, 'danger'); }
      break;

    case 'signout':
      await signOut();
      break;

    // ── Nav
    case 'nav':
      if (view) {
        showView(view);
        if (view === 'dashboard') renderDashboard();
        if (view === 'admin')     renderAdmin();
      }
      break;

    // ── Modals generic
    case 'close-modal':
      closeModal(modal || 'proj-overlay');
      break;

    // ── Projects
    case 'open-project':
      openProject(id);
      break;

    case 'new-project':
      openProjectModal(null);
      break;

    case 'edit-project':
      openProjectModal(S.currentProject);
      break;

    case 'save-project': {
      const nameInput = document.querySelector('#proj-name');
      const descInput = document.querySelector('#proj-desc');
      const name = nameInput?.value.trim();
      if (!name) { nameInput?.focus(); break; }

      const editId   = $('proj-overlay')?.dataset.editId;
      const workflow = getWorkflowStages();

      const saved = await saveProject({
        id:          editId || undefined,
        name,
        description: descInput?.value.trim() ?? '',
        workflow:    workflow.length ? workflow : (S.org?.workflow ?? ['To Do', 'In Progress', 'Done']),
      });
      closeModal('proj-overlay');
      toast(editId ? 'Project updated' : 'Project created', 'success');
      break;
    }

    // ── Workflow stage editor
    case 'add-stage': {
      const inp = $('new-stage-input');
      const val = inp?.value.trim();
      if (!val) break;
      const container = $('wf-tags-container');
      if (!container) break;
      const idx = container.querySelectorAll('.wf-tag').length;
      const tag = document.createElement('span');
      tag.className = 'wf-tag';
      tag.dataset.index = String(idx);
      tag.innerHTML = `${esc(val)}<button class="wf-rm" data-action="remove-stage" data-index="${idx}" title="Remove">×</button>`;
      container.appendChild(tag);
      if (inp) inp.value = '';
      break;
    }

    case 'remove-stage': {
      const tag = btn.closest('.wf-tag');
      if (tag) tag.remove();
      break;
    }

    // ── Tasks
    case 'new-task':
      openTaskModal(null, stage || (S.currentProject?.workflow?.[0] ?? null));
      break;

    case 'edit-task': {
      const tasks = S.tasks[S.currentProject?.id] ?? [];
      const task  = tasks.find(t => t.id === id);
      if (task) openTaskModal(task);
      break;
    }

    case 'save-task':
      await saveTaskFromModal();
      break;

    case 'delete-task':
      if (!confirm('Delete this task? This cannot be undone.')) break;
      await deleteTask(S.currentProject.id, id);
      toast('Task deleted');
      break;

    case 'open-task-detail':
      openTaskDetail(id);
      break;

    case 'move-task': {
      const project  = S.currentProject;
      if (!project) break;
      const workflow = project.workflow ?? [];
      const tasks    = S.tasks[project.id] ?? [];
      const task     = tasks.find(t => t.id === id);
      if (!task) break;
      const curIdx = workflow.indexOf(task.stage);
      const next   = curIdx + dir;
      if (next < 0 || next >= workflow.length) break;
      const newStage  = workflow[next];
      const isLast    = next === workflow.length - 1;
      await updateTask(project.id, id, { stage: newStage, isLastStage: isLast });
      if (isLast) handleTaskCompleted(task, newStage);
      toast(`Moved to "${esc(newStage)}"`, 'success');
      break;
    }

    // ── Task detail
    case 'post-comment':
      await postComment();
      break;

    case 'ai-describe': {
      const result = $('ai-desc-result');
      const taskId = S.currentTaskId;
      const tasks  = S.tasks[S.currentProject?.id] ?? [];
      const task   = tasks.find(t => t.id === taskId);
      if (!task || !result) break;
      result.style.display = 'block';
      result.textContent   = 'Generating…';
      const desc = await aiGenerateDesc(task.title);
      result.textContent = desc;
      break;
    }

    case 'ai-sprint-insights':
      await loadSprintInsights();
      break;

    // ── Setup screen
    case 'setup-create': {
      const nameEl   = $('setup-org-name');
      const domainEl = $('setup-org-domain');
      const name     = nameEl?.value.trim();
      const domain   = domainEl?.value.trim() || S.user?.email?.split('@')[1] || '';
      if (!name) { nameEl?.focus(); break; }
      const wf = ['To Do', 'In Progress', 'Review', 'Done'];
      try {
        await createOrg({ name, domain, workflow: wf });
        initApp();
        toast('Organisation created!', 'success');
      } catch (err) {
        toast('Failed to create org: ' + err.message, 'danger');
      }
      break;
    }

    case 'setup-join': {
      const codeEl = $('setup-join-code');
      const code   = codeEl?.value.trim();
      if (!code) { codeEl?.focus(); break; }
      const ok = await joinOrg(code);
      if (ok) { initApp(); toast('Joined organisation!', 'success'); }
      else    toast('Org not found — check the code', 'warn');
      break;
    }

    // ── Kanban back
    case 'back':
      showView('projects');
      break;

    // ── Workflow edit
    case 'edit-workflow':
      openProjectModal(S.currentProject);
      break;

    // ── Invite member
    case 'invite-member':
      openModal('invite-overlay');
      break;

    case 'copy-org-id': {
      const id = S.org?.id ?? '';
      navigator.clipboard?.writeText(id).then(() => toast('Org ID copied!', 'success'));
      break;
    }

    // ── Admin
    case 'remove-member':
      await removeMember(id);
      break;

    default:
      break;
  }
}

function handleChange(e) {
  const sel = e.target.closest('[data-action="change-role"]');
  if (!sel) return;
  const uid     = sel.dataset.uid;
  const newRole = sel.value;
  if (uid && newRole) changeRole(uid, newRole);
}

async function handleKanbanDrop(e) {
  const { taskId, toStage } = e.detail;
  const project = S.currentProject;
  if (!project) return;
  const workflow = project.workflow ?? [];
  const isLast   = toStage === workflow[workflow.length - 1];
  const tasks    = S.tasks[project.id] ?? [];
  const task     = tasks.find(t => t.id === taskId);
  if (!task) return;

  await updateTask(project.id, taskId, { stage: toStage, isLastStage: isLast });
  if (isLast) handleTaskCompleted(task, toStage);
  toast(`Moved to "${esc(toStage)}"`, 'success');
}

// ── Notification helpers ──────────────────────────────────────────────────────
async function handleTaskCompleted(task, stage) {
  const manager = S.members.find(m => m.role === 'manager' || m.role === 'ceo');
  if (manager?.email) notifyCompleted({ ...task, stage }, manager.email);

  chatNotify({
    title:    `Task completed: ${task.title}`,
    subtitle: `Project: ${S.currentProject?.name ?? ''}`,
    body:     `Assignee: ${task.assigneeName ?? ''} | Stage: ${stage}`,
  });
}

export async function handleTaskCreated(task) {
  const assignee = S.members.find(m => m.uid === task.assigneeId || m.id === task.assigneeId);
  if (assignee?.email) {
    notifyAssigned({ ...task, projectName: S.currentProject?.name ?? '' }, assignee.email);
  }

  chatNotify({
    title:    `New task: ${task.title}`,
    subtitle: `Assigned to ${task.assigneeName ?? 'unassigned'}`,
    body:     `Project: ${S.currentProject?.name ?? ''} | Priority: ${task.priority}`,
  });
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
function wireKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      // Submit whichever modal form is open
      if ($('task-overlay')?.classList.contains('open'))  saveTaskFromModal();
      if ($('proj-overlay')?.classList.contains('open'))  $('proj-save-btn')?.click();
    }
  });
}

// ── Expose minimal globals for dynamically rendered HTML ──────────────────────
// Only used as last resort; prefer data-action delegation.
// (Nothing currently needs globals — all interactions are delegated.)

// ── Start ─────────────────────────────────────────────────────────────────────
boot();
