import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
const splashDir = path.join(publicDir, 'splash');

// Ensure directories exist
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
if (!fs.existsSync(splashDir)) fs.mkdirSync(splashDir, { recursive: true });

// Icon sizes needed
const iconSizes = [32, 72, 96, 128, 144, 152, 180, 192, 384, 512];

// Splash screen sizes for iOS
const splashSizes = [
  { width: 640, height: 1136 },
  { width: 750, height: 1334 },
  { width: 1242, height: 2208 },
  { width: 1125, height: 2436 },
  { width: 1170, height: 2532 }
];

// Create base SVG icon
const createIconSvg = (size) => {
  const padding = Math.floor(size * 0.1);
  const innerSize = size - (padding * 2);
  const cornerRadius = Math.floor(size * 0.15);
  
  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981"/>
          <stop offset="100%" style="stop-color:#059669"/>
        </linearGradient>
        <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.3)"/>
          <stop offset="50%" style="stop-color:rgba(255,255,255,0)"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" rx="${cornerRadius}" fill="url(#bg)"/>
      
      <!-- Shine overlay -->
      <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize * 0.5}" rx="${cornerRadius}" fill="url(#shine)"/>
      
      <!-- Barcode scanner icon -->
      <g transform="translate(${size * 0.2}, ${size * 0.25})" fill="white">
        <!-- Top left corner -->
        <rect x="0" y="0" width="${size * 0.12}" height="${size * 0.04}" rx="${size * 0.01}"/>
        <rect x="0" y="0" width="${size * 0.04}" height="${size * 0.12}" rx="${size * 0.01}"/>
        
        <!-- Top right corner -->
        <rect x="${size * 0.48}" y="0" width="${size * 0.12}" height="${size * 0.04}" rx="${size * 0.01}"/>
        <rect x="${size * 0.56}" y="0" width="${size * 0.04}" height="${size * 0.12}" rx="${size * 0.01}"/>
        
        <!-- Bottom left corner -->
        <rect x="0" y="${size * 0.38}" width="${size * 0.12}" height="${size * 0.04}" rx="${size * 0.01}"/>
        <rect x="0" y="${size * 0.3}" width="${size * 0.04}" height="${size * 0.12}" rx="${size * 0.01}"/>
        
        <!-- Bottom right corner -->
        <rect x="${size * 0.48}" y="${size * 0.38}" width="${size * 0.12}" height="${size * 0.04}" rx="${size * 0.01}"/>
        <rect x="${size * 0.56}" y="${size * 0.3}" width="${size * 0.04}" height="${size * 0.12}" rx="${size * 0.01}"/>
        
        <!-- Barcode lines -->
        <rect x="${size * 0.08}" y="${size * 0.12}" width="${size * 0.04}" height="${size * 0.18}"/>
        <rect x="${size * 0.16}" y="${size * 0.12}" width="${size * 0.02}" height="${size * 0.18}"/>
        <rect x="${size * 0.22}" y="${size * 0.12}" width="${size * 0.05}" height="${size * 0.18}"/>
        <rect x="${size * 0.31}" y="${size * 0.12}" width="${size * 0.03}" height="${size * 0.18}"/>
        <rect x="${size * 0.38}" y="${size * 0.12}" width="${size * 0.02}" height="${size * 0.18}"/>
        <rect x="${size * 0.44}" y="${size * 0.12}" width="${size * 0.04}" height="${size * 0.18}"/>
        <rect x="${size * 0.52}" y="${size * 0.12}" width="${size * 0.02}" height="${size * 0.18}"/>
        
        <!-- Check mark -->
        <path d="${createCheckPath(size * 0.25)}" stroke="white" stroke-width="${size * 0.04}" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="translate(${size * 0.18}, ${size * 0.3})"/>
      </g>
    </svg>
  `);
};

// Create checkmark path
const createCheckPath = (size) => {
  return `M ${size * 0.1} ${size * 0.5} L ${size * 0.4} ${size * 0.8} L ${size * 0.9} ${size * 0.2}`;
};

// Create splash screen SVG
const createSplashSvg = (width, height) => {
  const logoSize = Math.min(width, height) * 0.3;
  const centerX = width / 2;
  const centerY = height / 2 - logoSize * 0.3;
  
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="splashBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981"/>
          <stop offset="100%" style="stop-color:#047857"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#splashBg)"/>
      
      <!-- Icon container -->
      <g transform="translate(${centerX - logoSize/2}, ${centerY - logoSize/2})">
        <rect width="${logoSize}" height="${logoSize}" rx="${logoSize * 0.15}" fill="white" fill-opacity="0.2"/>
        
        <!-- Barcode scanner icon -->
        <g transform="translate(${logoSize * 0.15}, ${logoSize * 0.2})" fill="white">
          <!-- Top left corner -->
          <rect x="0" y="0" width="${logoSize * 0.15}" height="${logoSize * 0.05}" rx="${logoSize * 0.01}"/>
          <rect x="0" y="0" width="${logoSize * 0.05}" height="${logoSize * 0.15}" rx="${logoSize * 0.01}"/>
          
          <!-- Top right corner -->
          <rect x="${logoSize * 0.55}" y="0" width="${logoSize * 0.15}" height="${logoSize * 0.05}" rx="${logoSize * 0.01}"/>
          <rect x="${logoSize * 0.65}" y="0" width="${logoSize * 0.05}" height="${logoSize * 0.15}" rx="${logoSize * 0.01}"/>
          
          <!-- Bottom left corner -->
          <rect x="0" y="${logoSize * 0.45}" width="${logoSize * 0.15}" height="${logoSize * 0.05}" rx="${logoSize * 0.01}"/>
          <rect x="0" y="${logoSize * 0.35}" width="${logoSize * 0.05}" height="${logoSize * 0.15}" rx="${logoSize * 0.01}"/>
          
          <!-- Bottom right corner -->
          <rect x="${logoSize * 0.55}" y="${logoSize * 0.45}" width="${logoSize * 0.15}" height="${logoSize * 0.05}" rx="${logoSize * 0.01}"/>
          <rect x="${logoSize * 0.65}" y="${logoSize * 0.35}" width="${logoSize * 0.05}" height="${logoSize * 0.15}" rx="${logoSize * 0.01}"/>
          
          <!-- Center lines -->
          <rect x="${logoSize * 0.1}" y="${logoSize * 0.15}" width="${logoSize * 0.06}" height="${logoSize * 0.2}"/>
          <rect x="${logoSize * 0.2}" y="${logoSize * 0.15}" width="${logoSize * 0.03}" height="${logoSize * 0.2}"/>
          <rect x="${logoSize * 0.27}" y="${logoSize * 0.15}" width="${logoSize * 0.07}" height="${logoSize * 0.2}"/>
          <rect x="${logoSize * 0.38}" y="${logoSize * 0.15}" width="${logoSize * 0.04}" height="${logoSize * 0.2}"/>
          <rect x="${logoSize * 0.46}" y="${logoSize * 0.15}" width="${logoSize * 0.03}" height="${logoSize * 0.2}"/>
          <rect x="${logoSize * 0.53}" y="${logoSize * 0.15}" width="${logoSize * 0.06}" height="${logoSize * 0.2}"/>
        </g>
      </g>
      
      <!-- App name -->
      <text x="${centerX}" y="${centerY + logoSize * 0.7}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${logoSize * 0.2}" font-weight="700" fill="white">ScanAndSwap</text>
      <text x="${centerX}" y="${centerY + logoSize * 0.9}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${logoSize * 0.1}" fill="white" fill-opacity="0.8">Know better. Swap smarter.</text>
    </svg>
  `);
};

async function generateIcons() {
  console.log('Generating icons...');
  
  for (const size of iconSizes) {
    const svg = createIconSvg(size);
    
    // Regular icon
    await sharp(svg)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));
    
    console.log(`  Created icon-${size}.png`);
  }
  
  // Apple touch icon (180x180)
  const appleSvg = createIconSvg(180);
  await sharp(appleSvg)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('  Created apple-touch-icon.png');
  
  // Favicon
  const faviconSvg = createIconSvg(32);
  await sharp(faviconSvg)
    .png()
    .toFile(path.join(iconsDir, 'favicon.png'));
  console.log('  Created favicon.png');
}

async function generateSplashScreens() {
  console.log('Generating splash screens...');
  
  for (const { width, height } of splashSizes) {
    const svg = createSplashSvg(width, height);
    
    await sharp(svg)
      .png()
      .toFile(path.join(splashDir, `splash-${width}x${height}.png`));
    
    console.log(`  Created splash-${width}x${height}.png`);
  }
}

async function main() {
  try {
    await generateIcons();
    await generateSplashScreens();
    console.log('\nAll assets generated successfully!');
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

main();
