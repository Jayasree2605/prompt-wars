/**
 * firebase.js — Firebase app init, Firestore db, and Auth exports.
 * Reads config from window.APP_CONFIG.firebase (set in config.js).
 */

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }         from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const cfg = window.APP_CONFIG?.firebase;
if (!cfg) throw new Error('[firebase] window.APP_CONFIG.firebase is not set');

const app = initializeApp(cfg);

export const db   = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
