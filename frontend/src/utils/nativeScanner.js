/**
 * Barcode Scanner Abstraction
 * 
 * Native (iOS/Android): Uses @capacitor-mlkit/barcode-scanning
 *   - ML Kit runs on-device neural network
 *   - Works in low light, damaged barcodes, weird angles
 *   - ~50ms scan time vs ~500ms for WASM decoder
 *   - Native camera UI with haptic feedback
 * 
 * Web/PWA: Uses html5-qrcode (existing behavior)
 *   - WASM-based decoder in the browser
 *   - Decent but struggles with glare and distance
 */

import { isNative } from './platform';

let nativeScanner = null;

// Lazy-load native scanner only when needed
async function getNativeScanner() {
  if (nativeScanner) return nativeScanner;
  try {
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    nativeScanner = BarcodeScanner;
    return nativeScanner;
  } catch (e) {
    console.warn('Native barcode scanner not available:', e);
    return null;
  }
}

/**
 * Check if barcode scanning is supported
 */
export async function isScanSupported() {
  if (isNative) {
    try {
      const scanner = await getNativeScanner();
      if (!scanner) return false;
      const result = await scanner.isSupported();
      return result.supported;
    } catch {
      return false;
    }
  }
  // Web: check for camera
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Request camera permission
 */
export async function requestPermission() {
  if (isNative) {
    try {
      const scanner = await getNativeScanner();
      if (!scanner) return false;
      const status = await scanner.requestPermissions();
      return status.camera === 'granted';
    } catch {
      return false;
    }
  }
  // Web: permission is requested when getUserMedia is called
  return true;
}

/**
 * Scan a barcode using native ML Kit scanner
 * Returns: { upc: string } or null if cancelled
 * 
 * This opens a full-screen native camera overlay with real-time
 * ML Kit barcode detection. Way faster and more reliable than
 * the html5-qrcode WASM approach.
 */
export async function scanNative() {
  if (!isNative) return null;

  const scanner = await getNativeScanner();
  if (!scanner) return null;

  try {
    // Add scanning UI class to body (hides webview content behind native camera)
    document.querySelector('body')?.classList.add('barcode-scanning-active');
    document.querySelector('html')?.classList.add('barcode-scanning-active');

    const result = await scanner.scan({
      formats: [
        'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E',
        'CODE_128', 'CODE_39', 'ITF'
      ]
    });

    document.querySelector('body')?.classList.remove('barcode-scanning-active');
    document.querySelector('html')?.classList.remove('barcode-scanning-active');

    if (result.barcodes && result.barcodes.length > 0) {
      const barcode = result.barcodes[0];
      
      // Haptic feedback on successful scan
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {}

      return { upc: barcode.rawValue };
    }

    return null; // User cancelled
  } catch (error) {
    document.querySelector('body')?.classList.remove('barcode-scanning-active');
    document.querySelector('html')?.classList.remove('barcode-scanning-active');
    
    if (error.message?.includes('canceled') || error.message?.includes('cancelled')) {
      return null; // User cancelled — not an error
    }
    throw error;
  }
}

/**
 * Stop native scanner if running
 */
export async function stopNativeScanner() {
  if (!isNative) return;
  try {
    const scanner = await getNativeScanner();
    if (scanner) {
      await scanner.stopScan();
      document.querySelector('body')?.classList.remove('barcode-scanning-active');
    document.querySelector('html')?.classList.remove('barcode-scanning-active');
    }
  } catch {}
}

/**
 * Check if we should use the native scanner
 */
export function shouldUseNativeScanner() {
  return isNative;
}
