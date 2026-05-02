/**
 * api/chat.js — Google Chat webhook notifications.
 */

/**
 * Send a notification card to the configured Google Chat space.
 * Silently fails if the webhook URL is not configured.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.subtitle
 * @param {string} [opts.body]
 */
export async function chatNotify({ title, subtitle, body = '' }) {
  const url = window.APP_CONFIG?.googleChat?.webhookUrl;
  if (!url || url.startsWith('YOUR_')) return;

  const payload = {
    cards: [{
      header: { title, subtitle },
      sections: body ? [{
        widgets: [{ textParagraph: { text: body } }],
      }] : [],
    }],
  };

  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[chat] webhook failed', err);
  }
}
