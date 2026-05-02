/**
 * services/projects.js — Firestore project subscriptions and mutations.
 * Emits projects:updated after each snapshot.
 */

import { db }                 from '../firebase.js';
import {
  collection, doc, onSnapshot,
  setDoc, updateDoc, serverTimestamp,
  query, where,
}                              from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { S, emit }            from '../state.js';
import { genId }              from '../utils/format.js';

/**
 * Subscribe to projects for the current org, respecting role-based filters.
 * Pushes unsubscribe fn into S.listeners.
 */
export function subscribeProjects() {
  const orgId = S.org?.id;
  if (!orgId) return;

  const role = S.profile?.role;
  const uid  = S.user?.uid;

  let q;
  if (role === 'ceo') {
    // CEO sees all org projects
    q = query(collection(db, 'projects'), where('orgId', '==', orgId));
  } else if (role === 'manager') {
    // Manager sees projects where they are in the members array
    q = query(
      collection(db, 'projects'),
      where('orgId', '==', orgId),
      where('members', 'array-contains', uid)
    );
  } else {
    // Employee: same — only projects they are members of
    q = query(
      collection(db, 'projects'),
      where('orgId', '==', orgId),
      where('members', 'array-contains', uid)
    );
  }

  try {
    const unsub = onSnapshot(q, snap => {
      S.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      emit('projects:updated', S.projects);
    }, err => {
      console.warn('[projects] snapshot error (offline?)', err.message);
      emit('projects:updated', S.projects);
    });
    S.listeners.push(unsub);
  } catch (err) {
    console.warn('[projects] onSnapshot failed', err.message);
    emit('projects:updated', S.projects);
  }
}

/**
 * Create or update a project.
 * @param {object} data  project fields (id optional — if missing, creates new)
 * @returns {Promise<string>}  projectId
 */
export async function saveProject(data) {
  const orgId = S.org?.id;
  if (!orgId) throw new Error('No org loaded');

  const id  = data.id || genId();
  const ref = doc(db, 'projects', id);

  const payload = {
    id,
    orgId,
    name:        data.name,
    description: data.description ?? '',
    workflow:    data.workflow ?? S.org.workflow,
    members:     data.members ?? [S.user.uid],
    createdBy:   data.createdBy ?? S.user.uid,
    updatedAt:   serverTimestamp(),
  };

  if (!data.id) payload.createdAt = serverTimestamp();

  if (data.id) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }

  return id;
}
