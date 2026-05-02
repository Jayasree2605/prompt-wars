/**
 * api/gis.js — Google Identity Services (GIS) OAuth2 token management.
 * Used to acquire tokens for Gmail and Calendar APIs.
 */

import { S }     from '../state.js';
import { toast } from '../components/toast.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

let tokenClient = null;
let resolveToken = null;
let rejectToken  = null;

/**
 * Initialise the GIS token client (call once at startup).
 */
export function initGIS() {
  const clientId = window.APP_CONFIG?.google?.clientId;
  if (!clientId || clientId.startsWith('YOUR_')) {
    console.warn('[gis] Google OAuth clientId not configured — Gmail/Calendar disabled');
    return;
  }

  if (!window.google?.accounts?.oauth2) {
    console.warn('[gis] GIS library not loaded');
    return;
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope:     SCOPES,
    callback:  response => {
      if (response.error) {
        rejectToken?.(new Error(response.error));
        return;
      }
      S.calToken = response.access_token;
      resolveToken?.(response.access_token);
    },
  });
}

/**
 * Request a new Calendar/Gmail OAuth2 token via popup.
 * @returns {Promise<string>}  access_token
 */
export function requestCalToken() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('GIS not initialised'));
      return;
    }
    resolveToken = resolve;
    rejectToken  = reject;
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Return existing token or request a new one.
 * @returns {Promise<string>}
 */
export async function ensureToken() {
  if (S.calToken) return S.calToken;
  try {
    return await requestCalToken();
  } catch (err) {
    toast('Google auth required — please allow access', 'warn');
    throw err;
  }
}
