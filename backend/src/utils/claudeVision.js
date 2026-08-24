// ============================================================
// Shared Claude vision helper — used by receipt scanning
// (routes/receipts.js) and pantry photo scan (routes/pantry.js).
// One place owns the model choice, request shape, and error taxonomy.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

// Lazy singleton — the SDK constructor throws if no key is resolvable,
// so never construct at module load (routes must be importable without a key)
let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

// Sniff the actual image format from base64 magic bytes. The frontend
// sends whatever the user's camera/file produced — the receipt scanner in
// particular does no re-encoding, so PNG/WebP/HEIC uploads are possible.
export function detectMediaType(b64) {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('R0lGOD')) return 'image/gif';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg'; // most common; a mismatch fails loudly at the API
}

export class VisionNotConfiguredError extends Error {
  constructor() {
    super('Vision not configured. Set ANTHROPIC_API_KEY.');
    this.code = 'NOT_CONFIGURED';
  }
}

// Send 1+ images and an extraction prompt to Claude; returns the raw text
// of the response (callers own JSON parsing so their error handling and
// tests keep working unchanged). Throws:
//   VisionNotConfiguredError  — no ANTHROPIC_API_KEY set
//   Anthropic.APIError        — transport/API failures (callers map to 502)
//   Error('vision_refused')   — safety refusal survived the fallback chain
export async function claudeVisionExtract({ imagesBase64, prompt, maxTokens = 16000 }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new VisionNotConfiguredError();

  const response = await getClient().beta.messages.create({
    model: 'claude-opus-5',
    max_tokens: maxTokens,
    // Server-side refusal fallback: if a safety classifier declines, the API
    // re-runs the request on a fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{
      role: 'user',
      content: [
        ...imagesBase64.map(data => ({
          type: 'image',
          source: { type: 'base64', media_type: detectMediaType(data), data }
        })),
        { type: 'text', text: prompt }
      ]
    }]
  });

  if (response.stop_reason === 'refusal') {
    const err = new Error('vision_refused');
    err.code = 'REFUSED';
    throw err;
  }

  return response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}
