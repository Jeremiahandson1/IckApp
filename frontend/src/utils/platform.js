import { Capacitor } from '@capacitor/core';

/**
 * Platform detection for Ick
 * Determines runtime environment for conditional feature loading
 */

// Core platform checks
export const isNative = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isWeb = Capacitor.getPlatform() === 'web';

// PWA installed check (web only)
export const isPWA = isWeb && (
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true
);

// Feature availability
export const hasNativeCamera = isNative;
export const hasNativeScanner = isNative; // ML Kit barcode scanner
export const hasNativeHaptics = isNative;
export const hasNativePush = isNative;
export const hasNativeShare = isNative || !!navigator.share;

// Safe area insets (for notched devices)
export const getSafeAreaInsets = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--sat') || style.getPropertyValue('env(safe-area-inset-top)') || '0'),
    bottom: parseInt(style.getPropertyValue('--sab') || style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInt(style.getPropertyValue('--sal') || style.getPropertyValue('env(safe-area-inset-left)') || '0'),
    right: parseInt(style.getPropertyValue('--sar') || style.getPropertyValue('env(safe-area-inset-right)') || '0'),
  };
};

// Log platform info in dev
if (import.meta.env.DEV) {
  console.log(`[Platform] ${Capacitor.getPlatform()} | native=${isNative} | pwa=${isPWA}`);
}
