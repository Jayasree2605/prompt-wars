// TeamFlow — Configuration Template
// Copy this file to config.js and fill in your real keys.
// config.js is git-ignored so your secrets never reach GitHub.

window.APP_CONFIG = {

  // ── Firebase ──────────────────────────────────────────────────────────────
  // Firebase Console → Project Settings → Your apps → Web app → Config
  firebase: {
    apiKey:            "YOUR_FIREBASE_API_KEY",
    authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId:             "YOUR_FIREBASE_APP_ID"
  },

  // ── Google OAuth2 Client ID ───────────────────────────────────────────────
  // Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web)
  // Add your Cloud Run URL to Authorised JavaScript origins
  google: {
    clientId: "YOUR_CLIENT_ID.apps.googleusercontent.com"
  },

  // ── Gemini AI ─────────────────────────────────────────────────────────────
  // https://aistudio.google.com → Get API Key
  gemini: {
    apiKey: "YOUR_GEMINI_API_KEY",
    model:  "gemini-1.5-flash"
  },

  // ── Google Chat Webhook (optional) ────────────────────────────────────────
  // Chat space → Manage webhooks → Add webhook → copy URL
  googleChat: {
    webhookUrl: "YOUR_GOOGLE_CHAT_WEBHOOK_URL"
  },

  // ── App ───────────────────────────────────────────────────────────────────
  app: {
    orgDomain: "YOUR_ORG_EMAIL_DOMAIN"   // e.g. "acme.com"
  }
};
