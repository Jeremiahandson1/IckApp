#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Generate App Icons and Splash Screens for iOS and Android
# Requires: sharp-cli (npm install -g sharp-cli) or ImageMagick
# Input: A 1024x1024 PNG icon at frontend/public/icons/icon-1024.png
# ═══════════════════════════════════════════════════════════════════

set -e

FRONTEND_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"
SOURCE_ICON="$FRONTEND_DIR/public/icons/icon-1024.png"

if [ ! -f "$SOURCE_ICON" ]; then
  echo "✗ Source icon not found: $SOURCE_ICON"
  echo ""
  echo "Create a 1024x1024 PNG icon and place it at:"
  echo "  frontend/public/icons/icon-1024.png"
  echo ""
  echo "Design tips:"
  echo "  - Use the emerald green (#10b981) as primary color"
  echo "  - Keep the design simple — a barcode + leaf icon works"
  echo "  - No transparency for iOS App Store"
  echo "  - Rounded corners are auto-applied by iOS"
  exit 1
fi

echo "▸ Generating icons from $SOURCE_ICON"

# Check if npx sharp is available
if command -v npx &> /dev/null && npx sharp --version &> /dev/null 2>&1; then
  RESIZE="npx sharp"
elif command -v convert &> /dev/null; then
  RESIZE="imagemagick"
else
  echo "✗ Neither sharp-cli nor ImageMagick found."
  echo "  Install: npm install -g sharp-cli"
  echo "  Or:      brew install imagemagick"
  exit 1
fi

resize_icon() {
  local size=$1
  local output=$2
  
  if [ "$RESIZE" == "imagemagick" ]; then
    convert "$SOURCE_ICON" -resize "${size}x${size}" "$output"
  else
    npx sharp -i "$SOURCE_ICON" -o "$output" resize "$size" "$size"
  fi
  echo "  ✓ ${size}x${size} → $output"
}

# ── Android Icons ──
echo ""
echo "▸ Android icons..."
ANDROID_RES="$FRONTEND_DIR/android/app/src/main/res"
if [ -d "$ANDROID_RES" ]; then
  mkdir -p "$ANDROID_RES/mipmap-mdpi" "$ANDROID_RES/mipmap-hdpi" "$ANDROID_RES/mipmap-xhdpi" "$ANDROID_RES/mipmap-xxhdpi" "$ANDROID_RES/mipmap-xxxhdpi"
  resize_icon 48  "$ANDROID_RES/mipmap-mdpi/ic_launcher.png"
  resize_icon 72  "$ANDROID_RES/mipmap-hdpi/ic_launcher.png"
  resize_icon 96  "$ANDROID_RES/mipmap-xhdpi/ic_launcher.png"
  resize_icon 144 "$ANDROID_RES/mipmap-xxhdpi/ic_launcher.png"
  resize_icon 192 "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher.png"
  # Round icons (same for now)
  resize_icon 48  "$ANDROID_RES/mipmap-mdpi/ic_launcher_round.png"
  resize_icon 72  "$ANDROID_RES/mipmap-hdpi/ic_launcher_round.png"
  resize_icon 96  "$ANDROID_RES/mipmap-xhdpi/ic_launcher_round.png"
  resize_icon 144 "$ANDROID_RES/mipmap-xxhdpi/ic_launcher_round.png"
  resize_icon 192 "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher_round.png"
  # Play Store
  resize_icon 512 "$ANDROID_RES/../ic_launcher-playstore.png"
else
  echo "  ⚠ Android project not found. Run build-native.sh first."
fi

# ── iOS Icons ──
echo ""
echo "▸ iOS icons..."
IOS_ASSETS="$FRONTEND_DIR/ios/App/App/Assets.xcassets/AppIcon.appiconset"
if [ -d "$FRONTEND_DIR/ios" ]; then
  mkdir -p "$IOS_ASSETS"
  
  # All required iOS sizes
  for size in 20 29 40 58 60 76 80 87 120 152 167 180 1024; do
    resize_icon $size "$IOS_ASSETS/icon-${size}.png"
  done
  
  # Generate Contents.json for iOS
  cat > "$IOS_ASSETS/Contents.json" << 'ICONJSON'
{
  "images": [
    {"size": "20x20", "idiom": "iphone", "scale": "2x", "filename": "icon-40.png"},
    {"size": "20x20", "idiom": "iphone", "scale": "3x", "filename": "icon-60.png"},
    {"size": "29x29", "idiom": "iphone", "scale": "2x", "filename": "icon-58.png"},
    {"size": "29x29", "idiom": "iphone", "scale": "3x", "filename": "icon-87.png"},
    {"size": "40x40", "idiom": "iphone", "scale": "2x", "filename": "icon-80.png"},
    {"size": "40x40", "idiom": "iphone", "scale": "3x", "filename": "icon-120.png"},
    {"size": "60x60", "idiom": "iphone", "scale": "2x", "filename": "icon-120.png"},
    {"size": "60x60", "idiom": "iphone", "scale": "3x", "filename": "icon-180.png"},
    {"size": "20x20", "idiom": "ipad", "scale": "1x", "filename": "icon-20.png"},
    {"size": "20x20", "idiom": "ipad", "scale": "2x", "filename": "icon-40.png"},
    {"size": "29x29", "idiom": "ipad", "scale": "1x", "filename": "icon-29.png"},
    {"size": "29x29", "idiom": "ipad", "scale": "2x", "filename": "icon-58.png"},
    {"size": "40x40", "idiom": "ipad", "scale": "1x", "filename": "icon-40.png"},
    {"size": "40x40", "idiom": "ipad", "scale": "2x", "filename": "icon-80.png"},
    {"size": "76x76", "idiom": "ipad", "scale": "1x", "filename": "icon-76.png"},
    {"size": "76x76", "idiom": "ipad", "scale": "2x", "filename": "icon-152.png"},
    {"size": "83.5x83.5", "idiom": "ipad", "scale": "2x", "filename": "icon-167.png"},
    {"size": "1024x1024", "idiom": "ios-marketing", "scale": "1x", "filename": "icon-1024.png"}
  ],
  "info": {"version": 1, "author": "build-icons.sh"}
}
ICONJSON
  echo "  ✓ iOS Contents.json created"
else
  echo "  ⚠ iOS project not found. Run build-native.sh first."
fi

# ── PWA icons ──
echo ""
echo "▸ PWA icons..."
PWA_ICONS="$FRONTEND_DIR/public/icons"
mkdir -p "$PWA_ICONS"
for size in 32 48 72 96 128 144 152 192 384 512; do
  resize_icon $size "$PWA_ICONS/icon-${size}.png"
done
resize_icon 180 "$PWA_ICONS/apple-touch-icon.png"

echo ""
echo "✓ All icons generated!"
echo ""
echo "Splash screens: Use a tool like capacitor-assets"
echo "  npm install -g @capacitor/assets"
echo "  npx capacitor-assets generate"
