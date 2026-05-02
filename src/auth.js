/**
 * auth.js — Google sign-in, sign-out, and auth state observer.
 * Emits auth:ready and auth:signedout via state pub/sub.
 */

import { auth }                              from './firebase.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
}                                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { S, emit, resetState }               from './state.js';
import { db }                                from './firebase.js';
import {
  doc, getDoc, setDoc, serverTimestamp,
}                                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/calendar.readonly');

// ── sign in ──────────────────────────────────────────────────────────────────
export async function signIn() {
  // Demo mode: bypass Firebase auth if network is unavailable
  if (window._demoMode) return;
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.warn('[auth] popup failed, using demo mode', err.message);
    window._demoMode = true;
    S.user = { uid: 'demo-user', email: 'demo@teamflow.app' };
    S.profile = {
      uid: 'demo-user', displayName: 'Demo User',
      email: 'demo@teamflow.app', photoURL: '', role: 'ceo', orgId: null,
    };
    _authCallback?.(S.profile);
  }
}

// ── sign out ─────────────────────────────────────────────────────────────────
export async function signOut() {
  resetState();
  await fbSignOut(auth);
  emit('auth:signedout');
}

let _authCallback = null;

// ── auth state observer ──────────────────────────────────────────────────────
export function onAuthChange(callback) {
  _authCallback = callback;
  onAuthStateChanged(auth, async user => {
    if (!user) {
      callback(null);
      return;
    }

    S.user = user;

    const fallbackProfile = {
      uid:         user.uid,
      displayName: user.displayName || user.email.split('@')[0],
      email:       user.email,
      photoURL:    user.photoURL || '',
      role:        'employee',
      orgId:       null,
    };

    try {
      const profileRef = doc(db, 'profiles', user.uid);
      const snap = await getDoc(profileRef);

      if (!snap.exists()) {
        await setDoc(profileRef, { ...fallbackProfile, createdAt: serverTimestamp() });
        S.profile = (await getDoc(profileRef)).data() ?? fallbackProfile;
      } else {
        S.profile = snap.data();
      }
    } catch (err) {
      console.warn('[auth] Firestore unavailable, using local profile', err.message);
      S.profile = fallbackProfile;
    }

    callback(S.profile);
  });
}
