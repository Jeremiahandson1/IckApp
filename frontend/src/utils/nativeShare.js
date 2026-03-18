/**
 * Share Abstraction
 * Native: @capacitor/share (native share sheet with full app list)
 * Web: navigator.share or clipboard fallback
 */

import { isNative } from './platform';

let sharePlugin = null;

async function getSharePlugin() {
  if (sharePlugin) return sharePlugin;
  try {
    const { Share } = await import('@capacitor/share');
    sharePlugin = Share;
    return sharePlugin;
  } catch {
    return null;
  }
}

/**
 * Share product score card
 * @param {Object} opts - { title, text, url }
 * @returns {boolean} true if shared successfully
 */
export async function shareProduct({ title, text, url }) {
  if (isNative) {
    const share = await getSharePlugin();
    if (share) {
      try {
        await share.share({ title, text, url, dialogTitle: 'Share this product' });
        return true;
      } catch (e) {
        // User cancelled — not an error
        if (e.message?.includes('cancel')) return false;
        console.error('[Share] Native error:', e);
      }
    }
  }

  // Web Share API — only use on mobile (desktop implementations are unreliable)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (navigator.share && isMobile) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch {
      // User cancelled or API failed — fall through to clipboard
    }
  }

  // Clipboard fallback
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      return true; // Caller should show "Copied!" toast
    }
  } catch {
    // clipboard API failed — try execCommand fallback
  }

  // execCommand fallback for older browsers / insecure contexts
  try {
    const textarea = document.createElement('textarea');
    textarea.value = `${text}\n${url}`;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if native share is available
 */
export async function canShare() {
  if (isNative) {
    const share = await getSharePlugin();
    if (share) {
      try {
        const result = await share.canShare();
        return result.value;
      } catch {
        return true; // Assume yes on native
      }
    }
  }
  return !!navigator.share || !!navigator.clipboard;
}
