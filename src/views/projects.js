/**
 * views/projects.js — project grid rendering and project open handler.
 * Does NOT import services; receives data via state and is called by app.js.
 */

import { S }                  from '../state.js';
import { $, showView }        from '../utils/dom.js';
import { esc }                from '../utils/dom.js';
import { fmtDate, timeAgo }   from '../utils/format.js';
import { avatarHTML }         from '../utils/avatar.js';
import { subscribeTasksForProject } from '../services/tasks.js';
import { emit }               from '../state.js';

/**
 * Render the projects grid with current S.projects data.
 */
export function renderProjects() {
  const grid = $('projects-grid');
  if (!grid) return;

  if (!S.projects.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div style="font-size:2rem;margin-bottom:8px">📋</div>
        <p>No projects yet.<br>Click <strong>New Project</strong> to get started.</p>
      </div>`;
    return;
  }

  grid.innerHTML = S.projects.map(p => {
    const tasks     = S.tasks[p.id] ?? [];
    const total     = tasks.length;
    const lastStage = (p.workflow ?? [])[p.workflow.length - 1];
    const done      = tasks.filter(t => t.stage === lastStage).length;
    const pct       = total > 0 ? Math.round((done / total) * 100) : 0;
    const memberAvatars = (p.members ?? []).slice(0, 5).map(uid => {
      const m = S.members.find(x => x.uid === uid || x.id === uid);
      return m ? avatarHTML(m.displayName, 24, m.photoURL) : '';
    }).join('');

    return `
      <div class="project-card" data-action="open-project" data-id="${esc(p.id)}"
           role="button" tabindex="0" aria-label="Open project ${esc(p.name)}">
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.description || 'No description')}</p>
        <div class="prog-bar">
          <div class="prog-fill" style="width:${pct}%"></div>
        </div>
        <div class="prog-label">
          <span>${done}/${total} tasks</span>
          <span>${pct}%</span>
        </div>
        <div class="project-members" style="margin-top:12px">${memberAvatars}</div>
      </div>`;
  }).join('');
}

/**
 * Open a project: subscribe to its tasks and switch to kanban view.
 * @param {string} projectId
 */
export function openProject(projectId) {
  const project = S.projects.find(p => p.id === projectId);
  if (!project) return;

  S.currentProject = project;

  // Subscribe to tasks (adds unsub to S.listeners)
  subscribeTasksForProject(projectId);

  // Update kanban header title
  const titleEl = $('kanban-title');
  if (titleEl) titleEl.textContent = project.name;

  showView('kanban');
  emit('tasks:updated', { projectId, tasks: S.tasks[projectId] ?? [] });
}
