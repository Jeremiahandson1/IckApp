/**
 * Barcode Scanner Abstraction
 * 
 * Native (iOS/Android): Uses @capacitor-mlkit/barcode-scanning
 *   - startScan() + barcodeScanned event listener (no Google module required)
 *   - ML Kit runs on-device neural network
 *   - Works in low light, damaged barcodes, weird angles
 *   - Native camera UI with haptic feedback
 * 
 * Web/PWA: Uses html5-qrcode (existing behavior)
 *   - WASM-based decoder in the browser
 */

import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

let nativeScanner = null;

async function getScanner() {
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

export async function isScanSupported() {
  if (!isNative) return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  try {
    const scanner = await getScanner();
    if (!scanner) return false;
    const result = await scanner.isSupported();
    return result.supported;
  } catch {
    return false;
  }
}

export async function requestPermission() {
  if (!isNative) return true;
  try {
    const scanner = await getScanner();
    if (!scanner) return false;
    const status = await scanner.requestPermissions();
    return status.camera === 'granted' || status.camera === 'limited';
  } catch {
    return false;
  }
}

/**
 * Scan a barcode using startScan() + event listener
 * Does NOT require Google Barcode Scanner module
 * Returns: { upc: string } or null if cancelled
 */
export async function scanNative() {
  if (!isNative) return null;

  const scanner = await getScanner();
  if (!scanner) return null;

  return new Promise(async (resolve) => {
    let listener = null;
    let errorListener = null;

    const cleanup = async () => {
      try { await listener?.remove(); } catch {}
      try { await errorListener?.remove(); } catch {}
      try { await scanner.stopScan(); } catch {}
      document.querySelector('body')?.classList.remove('barcode-scanning-active');
      document.querySelector('html')?.classList.remove('barcode-scanning-active');
    };

    try {
      // Hide webview so native camera shows through
      document.querySelector('body')?.classList.add('barcode-scanning-active');
      document.querySelector('html')?.classList.add('barcode-scanning-active');

      // Listen for successful scan
      listener = await scanner.addListener('barcodeScanned', async (event) => {
        await cleanup();

        // Haptic feedback
        try {
          const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
          await Haptics.impact({ style: ImpactStyle.Medium });
        } catch {}

        resolve({ upc: event.barcode.rawValue });
      });

      // Listen for errors
      errorListener = await scanner.addListener('scanError', async (event) => {
        console.error('Scan error:', event.message);
        await cleanup();
        resolve(null);
      });

      // Start scanning
      await scanner.startScan({
        formats: ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'ITF']
      });

    } catch (error) {
      await cleanup();
      if (error.message?.includes('cancel') || error.message?.includes('dismiss')) {
        resolve(null);
      } else {
        throw error;
      }
    }
  });
}

export async function stopNativeScanner() {
  if (!isNative) return;
  try {
    const scanner = await getScanner();
    if (scanner) {
      await scanner.stopScan();
      await scanner.removeAllListeners();
    }
    document.querySelector('body')?.classList.remove('barcode-scanning-active');
    document.querySelector('html')?.classList.remove('barcode-scanning-active');
  } catch {}
}

export function shouldUseNativeScanner() {
  return isNative;
}
