# Ick — Native App Guide

## Overview

Ick runs as a native iOS and Android app via **Capacitor**, which wraps the React web app in a native WebView with access to native APIs. The same codebase serves web, PWA, iOS, and Android.

**Architecture:**
```
React (Vite) → Capacitor → Native WebView
                  ↓
          Native Plugins:
          ├── ML Kit Barcode Scanner (way faster than html5-qrcode)
          ├── Native Camera (for product photo contributions)
          ├── Push Notifications (APNs + FCM)
          ├── Native Share Sheet
          ├── Haptic Feedback
          ├── Status Bar Control
          └── Deep Linking
```

---

## Quick Start

### Prerequisites

| Platform | Requirements |
|----------|-------------|
| Android  | Node 18+, Android Studio, JDK 17 |
| iOS      | Node 18+, Xcode 15+, CocoaPods, macOS |

### First-Time Setup

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Build web app + create native projects
cd ..
./build-native.sh all

# 3. Open in IDE
cd frontend
npx cap open android    # Opens Android Studio
npx cap open ios        # Opens Xcode
```

### Development Workflow

```bash
# Option A: Hot Reload (recommended for development)
# 1. Edit capacitor.config.ts → uncomment server.url
# 2. Set your local IP: http://192.168.x.x:5173
cd frontend
npm run dev             # Start Vite dev server
npx cap run android     # Run on device/emulator with live reload

# Option B: Build-and-sync
cd frontend
npm run android:sync    # Build + sync to Android
npm run ios:sync        # Build + sync to iOS
```

---

## Native Features

### 1. ML Kit Barcode Scanner

On native, the app uses **Google ML Kit** instead of html5-qrcode:

| Feature | html5-qrcode (Web) | ML Kit (Native) |
|---------|-------------------|-----------------|
| Scan speed | ~500ms | ~50ms |
| Low light | Poor | Good |
| Damaged barcodes | Often fails | Usually works |
| Autofocus | Via constraints | Native AF |
| Memory | ~15MB WASM | ~3MB native |

**How it works:**
- `src/utils/nativeScanner.js` detects platform
- Native: Opens full-screen ML Kit camera overlay
- Web: Falls back to html5-qrcode with enhanced config
- Auto-detected — no user configuration needed

**Plugin:** `@capacitor-mlkit/barcode-scanning`

### 2. Push Notifications

| Platform | Technology | Token Type |
|----------|-----------|------------|
| iOS | Apple Push Notification service (APNs) | Device token |
| Android | Firebase Cloud Messaging (FCM) | Registration token |
| Web | Web Push API + VAPID | Push subscription |

**Setup required:**
- **Android:** Add `google-services.json` from Firebase Console to `android/app/`
- **iOS:** Enable Push Notifications capability in Xcode, upload APNs key to your push service

**How it works:**
- `src/utils/nativePush.js` handles registration
- Token sent to backend via `/api/auth/push-subscribe`
- Backend stores in `push_subscription` column on users table

### 3. Native Share

Uses `@capacitor/share` for the native share sheet (includes all installed apps: Messages, WhatsApp, Instagram, etc).

Falls back to Web Share API → clipboard on older browsers.

### 4. Deep Linking

**URL Schemes:**
- `ick://product/012345678901` — opens product directly
- `https://ick.com/product/012345678901` — universal link

**Android:** Intent filters added by `build-native.sh`
**iOS:** Configure Associated Domains in Xcode → `applinks:ick.com`

### 5. Haptic Feedback

Triggered on successful barcode scan via `@capacitor/haptics`. Provides physical confirmation that scan was detected.

---

## Building for Release

### Android (Google Play)

```bash
cd frontend

# 1. Build web + sync
npm run android:sync

# 2. Open Android Studio
npx cap open android

# 3. In Android Studio:
#    Build → Generate Signed Bundle/APK
#    Choose: Android App Bundle (.aab) for Play Store
#    Sign with your keystore
```

**Keystore (first time):**
```bash
keytool -genkey -v -keystore ick-release.keystore \
  -alias ick -keyalg RSA -keysize 2048 -validity 10000
```

### iOS (App Store)

```bash
cd frontend

# 1. Build web + sync
npm run ios:sync

# 2. Open Xcode
npx cap open ios

# 3. In Xcode:
#    Set your Team (requires Apple Developer account - $99/year)
#    Product → Archive
#    Distribute → App Store Connect
```

---

## App Store Listings

### Apple App Store

**App Name:** Ick — Food Scanner
**Subtitle:** Scan it. Ick it. Swap it.
**Category:** Health & Fitness
**Age Rating:** 4+

**Description:**
```
Scan any food barcode and instantly see what's really inside.

Ick gives you a science-based health score for any product, warns you about harmful additives, and suggests healthier alternatives you can actually buy at your store.

SCAN ANYTHING
• Point your camera at any barcode — instant results
• Works with 3 million+ products worldwide
• Score based on real Nutri-Score methodology

KNOW WHAT'S INSIDE
• Harmful additive warnings with severity levels
• Personal allergen alerts (gluten, dairy, nuts, and more)
• Scientific sources for every claim
• Scan for your whole family with separate profiles

SWAP SMARTER
• Curated healthier alternatives for 100+ popular products
• Side-by-side score comparisons
• Homemade recipes to replace processed foods

COMPLETELY FREE
• Unlimited barcode scanning — no daily limits
• No registration required to start scanning
• No ads. No affiliate links. No sponsored recommendations.
• Every score is independent.

Premium features include pantry management, smart shopping lists, velocity tracking, and family profiles.
```

**Keywords:** food scanner, barcode scanner, nutrition, ingredients, healthy food, allergen, nutri-score, food health, additive checker, swap

**Screenshots needed (6.7" and 5.5"):**
1. Scanning a barcode with score overlay
2. Product result page with score ring
3. Swap suggestion card
4. Allergen warning alert
5. Recipe detail page
6. Onboarding "Scan anything" screen

### Google Play Store

**Title:** Ick: Food Scanner & Health Score
**Short description:** Scan food barcodes for instant health scores, ingredient warnings & healthier swaps
**Category:** Health & Fitness
**Content rating:** Everyone

**(Full description same as iOS)**

---

## File Structure

```
frontend/
├── capacitor.config.ts          # Capacitor configuration
├── package.json                 # Dependencies (Capacitor + plugins)
├── src/
│   ├── utils/
│   │   ├── platform.js          # Platform detection (native/web/PWA)
│   │   ├── nativeScanner.js     # ML Kit barcode scanner abstraction
│   │   ├── nativePush.js        # Push notification abstraction
│   │   └── nativeShare.js       # Share abstraction
│   ├── main.jsx                 # Entry — adds native-app class, skips SW
│   ├── App.jsx                  # NativeLifecycle component (back btn, deep links)
│   ├── index.css                # Native-specific CSS (safe areas, scroll fixes)
│   └── pages/
│       └── Scan.jsx             # Dual scanner: ML Kit native + html5-qrcode web
├── android/                     # Generated by `cap add android`
│   └── app/
│       ├── src/main/AndroidManifest.xml
│       └── google-services.json # YOU ADD THIS (from Firebase)
├── ios/                         # Generated by `cap add ios`
│   └── App/
│       └── App.xcworkspace      # Open this in Xcode
└── dist/                        # Built web app (synced to native)

build-native.sh                  # One-command native setup
build-icons.sh                   # Generate all icon sizes from 1024x1024
```

---

## Troubleshooting

**"Camera not working on Android emulator"**
→ Use a physical device. Emulator camera is simulated and unreliable for barcode scanning.

**"ML Kit plugin not found"**
→ Run `npx cap sync` after installing. Android may need `File > Sync Project with Gradle Files` in Android Studio.

**"iOS build fails with signing error"**
→ Select your team in Xcode: Project → Signing & Capabilities → Team. Requires Apple Developer account.

**"Push notifications not arriving"**
→ Android: Ensure `google-services.json` is in `android/app/`. iOS: Check APNs key is uploaded and capability is enabled.

**"App shows blank white screen"**
→ Run `npm run build` then `npx cap sync`. The native app loads from `dist/` — if it's empty, nothing renders.

**"Hot reload not working"**
→ Uncomment `server.url` in `capacitor.config.ts` and set to your machine's local IP (not localhost). Device must be on same WiFi network.
