import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const possibleLogos = [
  path.join(process.cwd(), 'public', 'logo.png'),
  path.join(process.cwd(), 'public', 'logo.jpg'),
  path.join(process.cwd(), 'public', 'logo.jpeg'),
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
  console.error('❌ Error: Logo not found in public/ folder. Please ensure your logo is saved as public/logo.png');
  process.exit(1);
}

console.log(`🔍 Using logo at: ${logoPath}`);

const androidSizes = [
  { name: 'mipmap-mdpi', size: 48, foreground: 108 },
  { name: 'mipmap-hdpi', size: 72, foreground: 162 },
  { name: 'mipmap-xhdpi', size: 96, foreground: 216 },
  { name: 'mipmap-xxhdpi', size: 144, foreground: 324 },
  { name: 'mipmap-xxxhdpi', size: 192, foreground: 432 },
];

async function generateIcons() {
  console.log('🚀 Generating Android Icons...');

  for (const item of androidSizes) {
    const dir = path.join(androidResPath, item.name);
    if (fs.existsSync(dir)) {
      // Standard Icons
      await sharp(logoPath)
        .resize(item.size, item.size)
        .toFile(path.join(dir, 'ic_launcher.png'));

      await sharp(logoPath)
        .resize(item.size, item.size)
        .toFile(path.join(dir, 'ic_launcher_round.png'));

      // Adaptive Foreground (should be larger with padding)
      await sharp(logoPath)
        .resize(item.foreground, item.foreground, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toFile(path.join(dir, 'ic_launcher_foreground.png'));

      console.log(`✅ Generated ${item.name}`);
    }
  }

  // Also generate for Splash Screen
  const drawableDir = path.join(androidResPath, 'drawable');
  if (fs.existsSync(drawableDir)) {
      await sharp(logoPath)
        .resize(512, 512, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toFile(path.join(drawableDir, 'splash.png'));
      console.log('✅ Updated splash screen logo');
  }

  console.log('✨ All icons updated successfully!');
}

generateIcons().catch(err => {
  console.error('❌ Error during icon generation:', err);
});
