import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

export const isNative = Capacitor.isNativePlatform();

export function shouldUseNativeScanner() {
  // Prefer ML Kit on both native platforms — it is substantially better at 1D
  // product barcodes (UPC-A/EAN-13) than html5-qrcode, which is what made our
  // scanner feel worse than Yuka's.
  //
  // Android was previously pinned to html5-qrcode because ML Kit had issues
  // here. It is enabled now only because Scan.jsx falls back to the web scanner
  // when the native path reports unsupported or throws (see onNativeUnavailable)
  // — so the worst case is the old behaviour, not a broken scanner. Still wants
  // a real-hardware check.
  return Capacitor.isNativePlatform();
}

export async function isScanSupported() {
  if (!isNative) return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  try {
    const result = await BarcodeScanner.isSupported();
    return result.supported;
  } catch {
    return false;
  }
}

export async function requestPermission() {
  if (!isNative) return true;
  try {
    const status = await BarcodeScanner.requestPermissions();
    return status.camera === 'granted' || status.camera === 'limited';
  } catch {
    return false;
  }
}

export async function scanNative() {
  if (!isNative) return null;

  // @capacitor-mlkit/barcode-scanning opens its own native camera UI —
  // no WebView transparency needed. Just listen for the result.
  return new Promise((resolve, reject) => {
    let listener = null;
    let errorListener = null;

    const cleanup = async () => {
      try { await listener?.remove(); } catch {}
      try { await errorListener?.remove(); } catch {}
      try { await BarcodeScanner.stopScan(); } catch {}
    };

    (async () => {
      try {
        listener = await BarcodeScanner.addListener('barcodeScanned', async (event) => {
          await cleanup();
          const upc = event.barcode?.rawValue || event.barcode?.displayValue;
          try {
            const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
            await Haptics.impact({ style: ImpactStyle.Medium });
          } catch {}
          resolve({ upc });
        });

        errorListener = await BarcodeScanner.addListener('scanError', async (event) => {
          console.error('Scan error:', event.message);
          await cleanup();
          resolve(null);
        });

        await BarcodeScanner.startScan({
          formats: [
            BarcodeFormat.Ean13, BarcodeFormat.Ean8,
            BarcodeFormat.UpcA, BarcodeFormat.UpcE,
            BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Itf
          ]
        });

      } catch (error) {
        await cleanup();
        if (error.message?.includes('cancel') || error.message?.includes('dismiss')) {
          resolve(null);
        } else {
          reject(error);
        }
      }
    })();
  });
}

export async function stopNativeScanner() {
  if (!isNative) return;
  try {
    await BarcodeScanner.stopScan();
    await BarcodeScanner.removeAllListeners();
  } catch {}
}
