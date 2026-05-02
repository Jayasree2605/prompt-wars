/**
 * api/gemini.js — Gemini AI integration for task description generation
 * and sprint insights.
 */

import { S }     from '../state.js';
import { toast } from '../components/toast.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Low-level call to the Gemini generateContent endpoint.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function gemini(prompt) {
  const cfg = window.APP_CONFIG?.gemini;
  if (!cfg?.apiKey || cfg.apiKey.startsWith('YOUR_')) {
    return '(Gemini API key not configured)';
  }

  const model = cfg.model ?? 'gemini-1.5-flash';
  const url   = `${BASE}/${model}:generateContent?key=${cfg.apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
  };

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      ?? '(no response)';
  } catch (err) {
    console.error('[gemini]', err);
    toast('Gemini request failed', 'warn');
    return '(error)';
  }
}

/**
 * Generate a concise task description using Gemini.
 * @param {string} title   task title
 * @returns {Promise<string>}
 */
export async function aiGenerateDesc(title) {
  const prompt = `You are a project management assistant. Write a concise, actionable task description (2-3 sentences) for this task: "${title}". Focus on what needs to be done and any key acceptance criteria. Do not include headers or bullet points.`;
  return gemini(prompt);
}

/**
 * Generate sprint insights for the current project's tasks.
 * @param {Array} tasks   array of task objects
 * @param {string} projectName
 * @returns {Promise<string>}
 */
export async function aiSprintInsights(tasks, projectName) {
  const summary = tasks.map(t =>
    `- [${t.stage}] ${t.title} (${t.priority} priority, assigned to ${t.assigneeName ?? 'unassigned'})`
  ).join('\n');

  const prompt = `You are a project management assistant. Analyse these tasks for the project "${projectName}" and provide 3-4 concise sprint insights: what's going well, what's at risk, and one recommendation.\n\nTasks:\n${summary}\n\nKeep the response under 150 words, use plain text only.`;
  return gemini(prompt);
}
