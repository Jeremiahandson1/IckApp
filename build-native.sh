#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# ScanAndSwap — Native App Build Script
# Builds iOS and Android apps from the React web app using Capacitor
# ═══════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "═══════════════════════════════════════"
echo "  ScanAndSwap Native Build"
echo "═══════════════════════════════════════"

# Check prerequisites
check_prereqs() {
  echo ""
  echo "▸ Checking prerequisites..."
  
  if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found. Install from https://nodejs.org"
    exit 1
  fi
  echo "  ✓ Node.js $(node -v)"
  
  if ! command -v npm &> /dev/null; then
    echo "✗ npm not found"
    exit 1
  fi
  echo "  ✓ npm $(npm -v)"
  
  # Check for platform-specific tools
  if [[ "$1" == "ios" ]] || [[ "$1" == "all" ]]; then
    if ! command -v xcodebuild &> /dev/null; then
      echo "✗ Xcode not found. Install from App Store."
      echo "  Then run: sudo xcode-select --install"
      exit 1
    fi
    echo "  ✓ Xcode $(xcodebuild -version | head -1)"
    
    if ! command -v pod &> /dev/null; then
      echo "✗ CocoaPods not found. Run: sudo gem install cocoapods"
      exit 1
    fi
    echo "  ✓ CocoaPods $(pod --version)"
  fi
  
  if [[ "$1" == "android" ]] || [[ "$1" == "all" ]]; then
    if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
      echo "⚠ ANDROID_HOME not set. Android Studio required."
      echo "  Download: https://developer.android.com/studio"
    else
      echo "  ✓ Android SDK: ${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
    fi
  fi
}

# Install dependencies
install_deps() {
  echo ""
  echo "▸ Installing dependencies..."
  cd "$FRONTEND_DIR"
  npm install
}

# Build web app
build_web() {
  echo ""
  echo "▸ Building web app..."
  cd "$FRONTEND_DIR"
  npm run build
  echo "  ✓ Built to frontend/dist/"
}

# Initialize Capacitor platforms
init_platforms() {
  cd "$FRONTEND_DIR"
  
  if [[ "$1" == "android" ]] || [[ "$1" == "all" ]]; then
    if [ ! -d "android" ]; then
      echo ""
      echo "▸ Adding Android platform..."
      npx cap add android
      echo "  ✓ Android project created"
    fi
  fi
  
  if [[ "$1" == "ios" ]] || [[ "$1" == "all" ]]; then
    if [ ! -d "ios" ]; then
      echo ""
      echo "▸ Adding iOS platform..."
      npx cap add ios
      echo "  ✓ iOS project created"
      
      echo "▸ Installing iOS pods..."
      cd ios/App && pod install && cd ../..
      echo "  ✓ Pods installed"
    fi
  fi
}

# Sync web build to native platforms
sync_platforms() {
  echo ""
  echo "▸ Syncing to native platforms..."
  cd "$FRONTEND_DIR"
  npx cap sync
  echo "  ✓ Synced"
}

# Configure Android
configure_android() {
  if [ ! -d "$FRONTEND_DIR/android" ]; then return; fi
  
  echo ""
  echo "▸ Configuring Android..."
  
  # Add camera permission to AndroidManifest
  MANIFEST="$FRONTEND_DIR/android/app/src/main/AndroidManifest.xml"
  if ! grep -q "android.permission.CAMERA" "$MANIFEST" 2>/dev/null; then
    sed -i '/<application/i\    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.VIBRATE" />' "$MANIFEST"
    echo "  ✓ Camera permission added"
  fi
  
  # Add deep link intent filter
  if ! grep -q "scanandswap.com" "$MANIFEST" 2>/dev/null; then
    sed -i '/<\/activity>/i\            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="https" android:host="scanandswap.com" />\n                <data android:scheme="scanandswap" />\n            </intent-filter>' "$MANIFEST"
    echo "  ✓ Deep links configured"
  fi
  
  echo "  ✓ Android configured"
}

# Configure iOS
configure_ios() {
  if [ ! -d "$FRONTEND_DIR/ios" ]; then return; fi
  
  echo ""
  echo "▸ Configuring iOS..."
  echo "  Note: The following must be configured in Xcode:"
  echo "  1. Open ios/App/App.xcworkspace"
  echo "  2. Set Bundle ID: com.scanandswap.app"
  echo "  3. Set Team (Apple Developer account)"
  echo "  4. Capabilities → Camera Usage Description"
  echo "  5. Capabilities → Push Notifications"
  echo "  6. Associated Domains → applinks:scanandswap.com"
  echo "  ✓ iOS noted"
}

# Open IDE
open_ide() {
  cd "$FRONTEND_DIR"
  
  if [[ "$1" == "android" ]]; then
    echo ""
    echo "▸ Opening Android Studio..."
    npx cap open android
  elif [[ "$1" == "ios" ]]; then
    echo ""
    echo "▸ Opening Xcode..."
    npx cap open ios
  fi
}

# ═══════════════════════════════════════
# Main
# ═══════════════════════════════════════

PLATFORM="${1:-all}"  # android, ios, or all

case "$PLATFORM" in
  android|ios|all)
    check_prereqs "$PLATFORM"
    install_deps
    build_web
    init_platforms "$PLATFORM"
    sync_platforms
    configure_android
    configure_ios
    ;;
  open-android)
    open_ide "android"
    exit 0
    ;;
  open-ios)
    open_ide "ios"
    exit 0
    ;;
  *)
    echo "Usage: $0 [android|ios|all|open-android|open-ios]"
    echo ""
    echo "  android      — Build Android app"
    echo "  ios          — Build iOS app"
    echo "  all          — Build both (default)"
    echo "  open-android — Open in Android Studio"
    echo "  open-ios     — Open in Xcode"
    exit 1
    ;;
esac

echo ""
echo "═══════════════════════════════════════"
echo "  Build Complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
if [[ "$PLATFORM" == "android" ]] || [[ "$PLATFORM" == "all" ]]; then
  echo "  ANDROID:"
  echo "  → npx cap open android     (open Android Studio)"
  echo "  → Click ▶ Run              (test on emulator/device)"
  echo "  → Build > Generate Signed APK (for Play Store)"
  echo ""
fi
if [[ "$PLATFORM" == "ios" ]] || [[ "$PLATFORM" == "all" ]]; then
  echo "  iOS:"
  echo "  → npx cap open ios          (open Xcode)"
  echo "  → Select your team/signing"
  echo "  → Click ▶ Run               (test on simulator/device)"
  echo "  → Product > Archive          (for App Store)"
  echo ""
fi
echo "  DEV MODE (hot reload):"
echo "  1. Edit capacitor.config.ts → uncomment server.url"
echo "  2. Set url to your local IP: http://192.168.x.x:5173"
echo "  3. npm run dev (in frontend/)"
echo "  4. npx cap run android|ios"
echo ""
