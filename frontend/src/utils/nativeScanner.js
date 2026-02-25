import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

export const isNative = Capacitor.isNativePlatform();

export function shouldUseNativeScanner() {
  return isNative;
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

  return new Promise(async (resolve) => {
    let listener = null;
    let errorListener = null;

    const cleanup = async () => {
      try { await listener?.remove(); } catch {}
      try { await errorListener?.remove(); } catch {}
      try { await BarcodeScanner.stopScan(); } catch {}
      document.querySelector('body')?.classList.remove('barcode-scanning-active');
      document.querySelector('html')?.classList.remove('barcode-scanning-active');
    };

    try {
      document.querySelector('body')?.classList.add('barcode-scanning-active');
      document.querySelector('html')?.classList.add('barcode-scanning-active');

      listener = await BarcodeScanner.addListener('barcodeScanned', async (event) => {
        await cleanup();
        console.log('Barcode event:', JSON.stringify(event));
        const upc = event.barcode?.rawValue || event.barcode?.displayValue || event.rawValue || event.displayValue;
        console.log('UPC extracted:', upc);
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
        throw error;
      }
    }
  });
}

export async function stopNativeScanner() {
  if (!isNative) return;
  try {
    await BarcodeScanner.stopScan();
    await BarcodeScanner.removeAllListeners();
  } catch {}
  document.querySelector('body')?.classList.remove('barcode-scanning-active');
  document.querySelector('html')?.classList.remove('barcode-scanning-active');
}
