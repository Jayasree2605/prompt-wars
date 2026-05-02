/**
 * services/tasks.js — Firestore task CRUD + comments.
 * Emits tasks:updated after each snapshot.
 */

import { db }                 from '../firebase.js';
import {
  collection, doc, onSnapshot,
  setDoc, updateDoc, deleteDoc,
  arrayUnion, serverTimestamp,
  query, where,
}                              from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { S, emit }            from '../state.js';
import { genId }              from '../utils/format.js';

/**
 * Subscribe to tasks for a given project, respecting employee filtering.
 * @param {string} projectId
 */
export function subscribeTasksForProject(projectId) {
  const role = S.profile?.role;
  const uid  = S.user?.uid;

  let q;
  if (role === 'employee') {
    q = query(
      collection(db, 'projects', projectId, 'tasks'),
      where('assigneeId', '==', uid)
    );
  } else {
    q = collection(db, 'projects', projectId, 'tasks');
  }

  const unsub = onSnapshot(q, snap => {
    S.tasks[projectId] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('tasks:updated', { projectId, tasks: S.tasks[projectId] });
  }, err => console.error('[tasks] snapshot error', err));

  S.listeners.push(unsub);
}

/**
 * Create a new task in a project.
 * @param {string} projectId
 * @param {object} data
 * @returns {Promise<string>} taskId
 */
export async function createTask(projectId, data) {
  const id  = genId();
  const ref = doc(db, 'projects', projectId, 'tasks', id);

  await setDoc(ref, {
    id,
    projectId,
    title:        data.title,
    description:  data.description ?? '',
    stage:        data.stage,
    priority:     data.priority ?? 'medium',
    assigneeId:   data.assigneeId ?? null,
    assigneeName: data.assigneeName ?? '',
    dueDate:      data.dueDate ?? null,
    comments:     [],
    createdBy:    S.user.uid,
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  });

  return id;
}

/**
 * Update an existing task.
 * @param {string} projectId
 * @param {string} taskId
 * @param {object} data  partial update fields
 */
export async function updateTask(projectId, taskId, data) {
  const ref = doc(db, 'projects', projectId, 'tasks', taskId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a task.
 * @param {string} projectId
 * @param {string} taskId
 */
export async function deleteTask(projectId, taskId) {
  await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId));
}

/**
 * Add a comment to a task (stored as an array field on the task doc).
 * @param {string} projectId
 * @param {string} taskId
 * @param {object} comment  { id, text, authorId, authorName, createdAt }
 */
export async function addComment(projectId, taskId, comment) {
  const ref = doc(db, 'projects', projectId, 'tasks', taskId);
  await updateDoc(ref, {
    comments:  arrayUnion(comment),
    updatedAt: serverTimestamp(),
  });
}
