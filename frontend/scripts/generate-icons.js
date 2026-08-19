/**
 * Generates every derived icon + splash asset from the single master icon at
 * public/icons/icon-1024.png.
 *
 * Why this exists: frontend/android and frontend/ios are gitignored and
 * Codemagic regenerates them with `cap add` on every build. Anything hand-placed
 * in those folders is thrown away, so the native launcher icons and splash
 * screens have to be produced during CI. This script writes the source images
 * that `npx capacitor-assets generate` consumes, and codemagic.yaml runs both
 * before building.
 *
 * Outputs:
 *   assets/icon-only.png        1024  opaque  -> iOS AppIcon + Android legacy
 *   assets/icon-foreground.png  1024  alpha   -> Android adaptive foreground
 *   assets/icon-background.png  1024  opaque  -> Android adaptive background
 *   assets/splash.png           2732  opaque  -> iOS/Android splash
 *   assets/splash-dark.png      2732  opaque  -> dark-mode splash (same art)
 *   public/splash/*.png                       -> PWA splash screens
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(__dirname, '..');
const publicDir = path.join(frontendDir, 'public');
const iconsDir = path.join(publicDir, 'icons');
const splashDir = path.join(publicDir, 'splash');
const assetsDir = path.join(frontendDir, 'assets');

const MASTER = path.join(iconsDir, 'icon-1024.png');

// Brand colors, sampled from the master icon.
const ICON_BG = '#141821';   // icon plate
const ORANGE = '#f97316';    // badge
const SPLASH_BG = '#0a0a0a'; // matches SplashScreen.backgroundColor in capacitor.config.ts

// Artwork geometry, measured off the 512px master rendering. The icon plate
// occupies (30,30)-(482,482); everything below is in that same 512 space.
const SRC_512 = path.join(iconsDir, 'icon-512.png');
const CROP = { left: 30, top: 30, size: 453 };
const CIRCLE = { cx: 256, cy: 194, r: 115.5 };
const BANG = { x: 238, y: 131, w: 38, h: 127 };   // the "!" glyph, sits on orange
const WORD = { x: 145, y: 334, w: 233, h: 125 };  // the "ick" wordmark, sits on dark
// Bounding box of the visible artwork (badge top -> wordmark baseline).
const CONTENT = { x0: 141, y0: 79, x1: 371, y1: 451 };

const norm = (v, axis) => (v - (axis === 'x' ? CROP.left : CROP.top)) / CROP.size;

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

// Brightest channel of the icon plate. Anything at or below this is backdrop,
// not glyph, and has to key out to fully transparent.
const FLOOR = Math.max(
  parseInt(ICON_BG.slice(1, 3), 16),
  parseInt(ICON_BG.slice(3, 5), 16),
  parseInt(ICON_BG.slice(5, 7), 16)
);

/**
 * Turns white-on-plate artwork into white-on-transparent by promoting luminance
 * to alpha, rescaled so the plate color maps to alpha 0 rather than to its own
 * brightness. Without the rescale the backdrop survives as a faint lighter
 * rectangle around the wordmark once it is composited over the adaptive-icon
 * background. Antialiased glyph edges keep their partial alpha.
 */
async function whiteOnTransparent(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  const span = 255 - FLOOR;
  for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
    const lum = Math.max(data[i], data[i + 1], data[i + 2]);
    const a = Math.round(((lum - FLOOR) / span) * 255);
    out[o] = 255; out[o + 1] = 255; out[o + 2] = 255;
    out[o + 3] = a < 0 ? 0 : a > 255 ? 255 : a;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/**
 * Draws the Ick artwork onto a `width` x `height` canvas, with the artwork
 * plate scaled to `plate` px and its content bbox centered on (cxTarget,
 * cyTarget). `transparentWordmark` keys the wordmark for use over a backdrop
 * that does not match the icon plate color.
 */
async function renderArtwork({ width, height, plate, cxTarget, cyTarget, transparentWordmark }) {
  const s = plate / CROP.size;
  // Offset so the artwork's content bbox lands on the requested center.
  const contentCx = ((CONTENT.x0 + CONTENT.x1) / 2 - CROP.left) * s;
  const contentCy = ((CONTENT.y0 + CONTENT.y1) / 2 - CROP.top) * s;
  const ox = Math.round(cxTarget - contentCx);
  const oy = Math.round(cyTarget - contentCy);

  const at = (v, axis) => Math.round(norm(v, axis) * plate + (axis === 'x' ? ox : oy));

  const cx = ox + (CIRCLE.cx - CROP.left) * s;
  const cy = oy + (CIRCLE.cy - CROP.top) * s;
  const r = CIRCLE.r * s;
  // Vector circle: scaling the bitmap badge leaves a stair-stepped edge.
  const circle = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${ORANGE}"/></svg>`
  );

  const lift = async (box, backdrop) => sharp(SRC_512)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .resize(Math.max(1, Math.round(box.w * s)), Math.max(1, Math.round(box.h * s)), { kernel: 'lanczos3' })
    .flatten({ background: backdrop })
    .png().toBuffer();

  // The "!" keeps its orange backdrop, which matches the circle underneath it.
  const bang = await lift(BANG, ORANGE);
  let word = await lift(WORD, ICON_BG);
  if (transparentWordmark) word = await whiteOnTransparent(word);

  return [
    { input: circle, top: 0, left: 0 },
    { input: bang, left: at(BANG.x, 'x'), top: at(BANG.y, 'y') },
    { input: word, left: at(WORD.x, 'x'), top: at(WORD.y, 'y') },
  ];
}

async function generateCapacitorAssets() {
  ensureDir(assetsDir);

  // icon-only: the master, already opaque and full-bleed.
  await sharp(MASTER).removeAlpha().png({ compressionLevel: 9 })
    .toFile(path.join(assetsDir, 'icon-only.png'));
  console.log('  icon-only.png       1024 opaque');

  // Adaptive background: flat plate color.
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: ICON_BG } })
    .png({ compressionLevel: 9 }).toFile(path.join(assetsDir, 'icon-background.png'));
  console.log('  icon-background.png 1024 opaque');

  // Adaptive foreground: Android masks the outer ~33%, so the artwork has to
  // live inside the center safe zone or the wordmark gets clipped off.
  const SAFE = Math.round(1024 * 0.66);
  const plate = Math.round(SAFE / ((CONTENT.y1 - CONTENT.y0) / CROP.size));
  const layers = await renderArtwork({
    width: 1024, height: 1024, plate, cxTarget: 512, cyTarget: 512, transparentWordmark: true,
  });
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png({ compressionLevel: 9 })
    .toFile(path.join(assetsDir, 'icon-foreground.png'));
  console.log('  icon-foreground.png 1024 alpha, artwork inside 66% safe zone');

  // Splash: artwork centered on the brand dark, sized for the 2732 square that
  // Capacitor crops per-device.
  const splashPlate = Math.round(2732 * 0.30 / ((CONTENT.y1 - CONTENT.y0) / CROP.size));
  const splashLayers = await renderArtwork({
    width: 2732, height: 2732, plate: splashPlate, cxTarget: 1366, cyTarget: 1366,
    transparentWordmark: true,
  });
  const splashBuf = await sharp({ create: { width: 2732, height: 2732, channels: 3, background: SPLASH_BG } })
    .composite(splashLayers).removeAlpha().png({ compressionLevel: 9 }).toBuffer();

  for (const name of ['splash.png', 'splash-dark.png']) {
    await fs.promises.writeFile(path.join(assetsDir, name), splashBuf);
    console.log(`  ${name.padEnd(19)} 2732 opaque`);
  }
  return splashBuf;
}

// PWA splash screens. These replaced a stale set that still showed the old
// "ScanAndSwap" name and green palette.
const PWA_SPLASH = [
  { width: 640, height: 1136 }, { width: 750, height: 1334 },
  { width: 1242, height: 2208 }, { width: 1125, height: 2436 },
  { width: 1170, height: 2532 },
];

async function generatePwaSplash() {
  ensureDir(splashDir);
  for (const { width, height } of PWA_SPLASH) {
    const plate = Math.round(Math.min(width, height) * 0.42 / ((CONTENT.y1 - CONTENT.y0) / CROP.size));
    const layers = await renderArtwork({
      width, height, plate, cxTarget: width / 2, cyTarget: height / 2, transparentWordmark: true,
    });
    await sharp({ create: { width, height, channels: 3, background: SPLASH_BG } })
      .composite(layers).removeAlpha().png({ compressionLevel: 9 })
      .toFile(path.join(splashDir, `splash-${width}x${height}.png`));
    console.log(`  splash-${width}x${height}.png`);
  }
}

async function main() {
  if (!fs.existsSync(MASTER)) {
    console.error(`Master icon not found: ${MASTER}`);
    console.error('Expected a 1024x1024 opaque sRGB PNG (no alpha, no rounded corners).');
    process.exit(1);
  }

  console.log('Capacitor asset sources ->');
  await generateCapacitorAssets();
  console.log('\nPWA splash screens ->');
  await generatePwaSplash();
  console.log('\nDone. Run `npx capacitor-assets generate` to fan these into ios/ and android/.');
}

main().catch((err) => { console.error(err); process.exit(1); });
