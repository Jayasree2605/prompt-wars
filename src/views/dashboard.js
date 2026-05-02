/**
 * views/dashboard.js — render stats, workload bars, and calendar panel.
 */

import { S }                          from '../state.js';
import { $, esc }                     from '../utils/dom.js';
import { timeAgo }                    from '../utils/format.js';
import { avatarHTML }                 from '../utils/avatar.js';
import { fetchCalendar, renderCalendar } from '../api/calendar.js';
import { aiSprintInsights }           from '../api/gemini.js';

/**
 * Render the full dashboard view.
 */
export async function renderDashboard() {
  renderStats();
  renderWorkload();
  renderRecentTasks();
  loadCalendar();
}

// ── stats cards ──────────────────────────────────────────────────────────────
function renderStats() {
  const allTasks  = Object.values(S.tasks).flat();
  const total     = allTasks.length;
  const workflow  = S.currentProject?.workflow ?? S.org?.workflow ?? [];
  const lastStage = workflow[workflow.length - 1];

  // Count by first vs last stage vs other
  const firstStage = workflow[0];
  const nTodo      = allTasks.filter(t => t.stage === firstStage).length;
  const nDone      = allTasks.filter(t => t.stage === lastStage).length;
  const nProgress  = total - nTodo - nDone;
  const donePct    = total > 0 ? Math.round((nDone / total) * 100) : 0;

  setEl('stat-total',    total);
  setEl('stat-todo',     nTodo);
  setEl('stat-progress', nProgress);
  setEl('stat-done',     nDone);
  setEl('stat-pct',      `${donePct}%`);

  // Progress bar
  const pct = n => total > 0 ? `${(n / total * 100).toFixed(1)}%` : '0%';
  setStyle('pb-todo',     'width', pct(nTodo));
  setStyle('pb-progress', 'width', pct(nProgress));
  setStyle('pb-done',     'width', pct(nDone));
}

// ── workload panel ────────────────────────────────────────────────────────────
function renderWorkload() {
  const container = $('dash-workload');
  if (!container) return;

  const allTasks = Object.values(S.tasks).flat();
  const map      = {};

  S.members.forEach(m => { map[m.uid ?? m.id] = { member: m, count: 0 }; });
  allTasks.forEach(t => {
    if (t.assigneeId && map[t.assigneeId]) map[t.assigneeId].count++;
  });

  const rows = Object.values(map).sort((a, b) => b.count - a.count);
  const max  = Math.max(...rows.map(r => r.count), 1);

  if (!rows.length) {
    container.innerHTML = `<p class="text-muted">No members yet.</p>`;
    return;
  }

  container.innerHTML = rows.map(({ member: m, count }) => `
    <div class="wl-row">
      ${avatarHTML(m.displayName, 26, m.photoURL)}
      <span class="wl-name">${esc(m.displayName)}</span>
      <div class="wl-bar">
        <div class="wl-fill" style="width:${Math.round(count / max * 100)}%"></div>
      </div>
      <span class="wl-num">${count}</span>
    </div>`).join('');
}

// ── recent tasks ─────────────────────────────────────────────────────────────
function renderRecentTasks() {
  const container = $('dash-recent');
  if (!container) return;

  const allTasks = Object.values(S.tasks).flat()
    .sort((a, b) => (b.updatedAt?.toMillis?.() ?? b.updatedAt ?? 0) - (a.updatedAt?.toMillis?.() ?? a.updatedAt ?? 0))
    .slice(0, 12);

  if (!allTasks.length) {
    container.innerHTML = `<p class="text-muted">No tasks yet.</p>`;
    return;
  }

  container.innerHTML = allTasks.map(t => {
    const project = S.projects.find(p => p.id === t.projectId);
    const workflow = project?.workflow ?? [];
    const stageIdx = workflow.indexOf(t.stage);
    const color    = `var(--stage-${Math.max(0, stageIdx)})`;
    return `
      <div class="wl-row">
        <span class="chip" style="border-color:${color};color:${color};min-width:80px;justify-content:center">${esc(t.stage)}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</div>
          <div class="text-muted">${esc(project?.name ?? '')} · ${timeAgo(t.updatedAt)}</div>
        </div>
      </div>`;
  }).join('');
}

// ── calendar panel ────────────────────────────────────────────────────────────
async function loadCalendar() {
  const panel = $('calendar-panel');
  if (!panel) return;
  panel.innerHTML = `<div class="flex gap2"><span class="spinner"></span> Loading…</div>`;
  const events = await fetchCalendar(8);
  renderCalendar(events);
}

// ── AI sprint insights ────────────────────────────────────────────────────────
export async function loadSprintInsights() {
  const el = $('sprint-insights');
  if (!el) return;

  const project = S.currentProject;
  if (!project) { el.innerHTML = `<p class="text-muted">Open a project first.</p>`; return; }

  const tasks = S.tasks[project.id] ?? [];
  el.innerHTML = `<div class="flex gap2"><span class="spinner"></span> Generating insights…</div>`;
  const text = await aiSprintInsights(tasks, project.name);
  el.innerHTML = `<div class="ai-box">${esc(text)}</div>`;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function setEl(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}
function setStyle(id, prop, val) {
  const el = $(id);
  if (el) el.style[prop] = val;
}
