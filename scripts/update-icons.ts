import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const possibleLogos = [
  path.join(process.cwd(), 'public', 'Logo.png'),
  path.join(process.cwd(), 'public', 'logo.png'),
  path.join(process.cwd(), 'public', 'email-logo.png'),
];

let logoPath = '';
for (const p of possibleLogos) {
  if (fs.existsSync(p)) {
    logoPath = p;
    break;
  }
}

const androidResPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

if (!logoPath) {
  console.error('❌ Error: Logo not found in public/ folder.');
  process.exit(1);
}

console.log(`🔍 Using logo at: ${logoPath}`);

const androidSizes = [
  { name: 'mipmap-mdpi', size: 48, adaptive: 108 },
  { name: 'mipmap-hdpi', size: 72, adaptive: 162 },
  { name: 'mipmap-xhdpi', size: 96, adaptive: 216 },
  { name: 'mipmap-xxhdpi', size: 144, adaptive: 324 },
  { name: 'mipmap-xxxhdpi', size: 192, adaptive: 432 },
];

async function generateIcons() {
  console.log('🚀 Generating Android Icons...');

  for (const item of androidSizes) {
    const dir = path.join(androidResPath, item.name);
    if (fs.existsSync(dir)) {
      // 1. Classic Legacy Icons
      await sharp(logoPath)
        .resize(item.size, item.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .toFile(path.join(dir, 'ic_launcher.png'));

      await sharp(logoPath)
        .resize(item.size, item.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .toFile(path.join(dir, 'ic_launcher_round.png'));

      // 2. Adaptive Icon Foreground (Transparent background, logo in middle)
      // The adaptive foreground should be 108dp (e.g. 432px for xxxhdpi)
      await sharp(logoPath)
        .resize(Math.round(item.adaptive * 0.6), Math.round(item.adaptive * 0.6), { fit: 'contain' })
        .extend({
            top: Math.round(item.adaptive * 0.2),
            bottom: Math.round(item.adaptive * 0.2),
            left: Math.round(item.adaptive * 0.2),
            right: Math.round(item.adaptive * 0.2),
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .resize(item.adaptive, item.adaptive)
        .toFile(path.join(dir, 'ic_launcher_foreground.png'));

      console.log(`✅ Processed ${item.name}`);
    }
  }

  // 3. Splash Screen Logo
  const drawableDir = path.join(androidResPath, 'drawable');
  if (fs.existsSync(drawableDir)) {
      await sharp(logoPath)
        .resize(512, 512, { fit: 'inside' })
        .toFile(path.join(drawableDir, 'splash.png'));
      console.log('✅ Updated splash.png');
  }

  console.log('✨ All icons updated successfully!');
}

generateIcons().catch(err => {
  console.error('❌ Error:', err);
});
