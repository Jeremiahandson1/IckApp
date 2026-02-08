import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ick.app',
  appName: 'Ick',
  webDir: 'dist',

  server: {
    // Production: load from bundled files
    // Dev: uncomment below to hot-reload from Vite dev server
    // url: 'http://YOUR_LOCAL_IP:5173',
    // cleartext: true,
    androidScheme: 'https',
    iosScheme: 'capacitor',
    allowNavigation: ['*.ick.com', '*.openfoodfacts.org', '*.stripe.com']
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      androidSplashResourceName: 'splash',
      iosSpinnerStyle: 'small',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0a0a0a',
      overlaysWebView: false
    },
    Haptics: {},
    Camera: {
      // Used for product photo contributions
      quality: 70,
      allowEditing: false,
      resultType: 'base64'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    CapacitorMLKitBarcodeScanning: {
      // Uses Google ML Kit for native barcode scanning — way faster than html5-qrcode
      formats: ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'ITF']
    }
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0a0a0a',
    // Deep linking
    // After build, add intent filters in android/app/src/main/AndroidManifest.xml
  },

  ios: {
    backgroundColor: '#0a0a0a',
    contentInset: 'automatic',
    scrollEnabled: true,
    // Deep linking scheme
    scheme: 'ick'
  }
};

export default config;
