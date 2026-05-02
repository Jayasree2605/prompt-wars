/**
 * api/calendar.js — fetch upcoming events from Google Calendar API.
 */

import { ensureToken } from './gis.js';
import { esc }         from '../utils/dom.js';
import { toast }       from '../components/toast.js';

/**
 * Fetch the next N calendar events from the primary calendar.
 * @param {number} [maxResults=8]
 * @returns {Promise<Array>}  array of GCal event objects
 */
export async function fetchCalendar(maxResults = 8) {
  let token;
  try {
    token = await ensureToken();
  } catch {
    return [];
  }

  const now = new Date().toISOString();
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('maxResults',  String(maxResults));
  url.searchParams.set('orderBy',     'startTime');
  url.searchParams.set('singleEvents','true');
  url.searchParams.set('timeMin',      now);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Calendar API ${res.status}`);
    const data = await res.json();
    return data.items ?? [];
  } catch (err) {
    console.error('[calendar] fetchCalendar failed', err);
    toast('Could not load calendar events', 'warn');
    return [];
  }
}

/**
 * Render calendar events into the #calendar-panel element.
 * @param {Array} events  GCal event objects
 */
export function renderCalendar(events) {
  const panel = document.getElementById('calendar-panel');
  if (!panel) return;

  if (!events.length) {
    panel.innerHTML = `<p class="text-muted empty">No upcoming events.</p>`;
    return;
  }

  panel.innerHTML = events.map(ev => {
    const start   = ev.start?.dateTime ?? ev.start?.date ?? '';
    const date    = start ? new Date(start) : null;
    const timeStr = date
      ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : 'All day';
    const dateStr = date
      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '';
    return `
      <div class="meeting-item">
        <div class="meet-time">${esc(timeStr)}<br><small>${esc(dateStr)}</small></div>
        <div>
          <div class="meet-title">${esc(ev.summary ?? '(no title)')}</div>
          ${ev.location ? `<div class="meet-loc">${esc(ev.location)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}
