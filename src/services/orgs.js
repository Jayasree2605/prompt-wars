/**
 * services/orgs.js — org creation, joining, and loading.
 */

import { db }                 from '../firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, where, getDocs, serverTimestamp,
}                              from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { S, emit }            from '../state.js';
import { genId }              from '../utils/format.js';

/**
 * Create a new org and assign the current user as CEO.
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} opts.domain      e.g. "acme.com"
 * @param {string[]} opts.workflow  stage names array
 * @returns {Promise<string>}  orgId
 */
export async function createOrg({ name, domain, workflow }) {
  const orgId = genId();

  S.profile.orgId = orgId;
  S.profile.role  = 'ceo';
  S.org = { id: orgId, name, domain: (domain || '').toLowerCase(), workflow, createdBy: S.user?.uid };
  S.members = [{ ...S.profile }];
  emit('org:loaded', S.org);

  try {
    const orgRef = doc(db, 'orgs', orgId);
    await setDoc(orgRef, { id: orgId, name, domain: (domain || '').toLowerCase(), workflow, createdBy: S.user.uid, createdAt: serverTimestamp() });
    const profileRef = doc(db, 'profiles', S.user.uid);
    await updateDoc(profileRef, { orgId, role: 'ceo' });
  } catch (err) {
    console.warn('[orgs] Firestore write failed (offline), continuing in demo mode', err.message);
  }

  return orgId;
}

/**
 * Join an existing org by org code (orgId) as an employee.
 * @param {string} orgId
 * @returns {Promise<boolean>}
 */
export async function joinOrg(orgId) {
  const orgSnap = await getDoc(doc(db, 'orgs', orgId));
  if (!orgSnap.exists()) return false;

  const profileRef = doc(db, 'profiles', S.user.uid);
  await updateDoc(profileRef, { orgId, role: 'employee' });

  S.profile.orgId = orgId;
  S.profile.role  = 'employee';

  await loadOrg(orgId);
  return true;
}

/**
 * Load org document and all member profiles into state.
 * @param {string} orgId
 */
export async function loadOrg(orgId) {
  const orgSnap = await getDoc(doc(db, 'orgs', orgId));
  if (!orgSnap.exists()) throw new Error(`Org ${orgId} not found`);

  S.org = { id: orgSnap.id, ...orgSnap.data() };

  // Load all member profiles for this org
  const membersQuery = query(
    collection(db, 'profiles'),
    where('orgId', '==', orgId)
  );
  const membersSnap = await getDocs(membersQuery);
  S.members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  emit('org:loaded', S.org);
}
