import fs from 'fs';
import path from 'path';

const androidAppPath = path.join(process.cwd(), 'android', 'app');
const googleServicesJson = path.join(process.cwd(), 'google-services.json');

if (fs.existsSync(androidAppPath) && fs.existsSync(googleServicesJson)) {
  console.log('🚀 Copying google-services.json to android/app...');
  fs.copyFileSync(googleServicesJson, path.join(androidAppPath, 'google-services.json'));
}

// Patch build.gradle files for Firebase
const topGradlePath = path.join(process.cwd(), 'android', 'build.gradle');
const appGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');

if (fs.existsSync(topGradlePath)) {
  let content = fs.readFileSync(topGradlePath, 'utf8');
  if (!content.includes('com.google.gms:google-services')) {
    console.log('📦 Patching top-level build.gradle...');
    content = content.replace(
      /dependencies\s*{/,
      "dependencies {\n        classpath 'com.google.gms:google-services:4.4.0'"
    );
    fs.writeFileSync(topGradlePath, content);
  }
}

if (fs.existsSync(appGradlePath)) {
  let content = fs.readFileSync(appGradlePath, 'utf8');
  if (!content.includes("apply plugin: 'com.google.gms.google-services'")) {
    console.log('📦 Patching app-level build.gradle...');
    content += "\napply plugin: 'com.google.gms.google-services'\n";
    fs.writeFileSync(appGradlePath, content);
  }
}

console.log('✅ Android patches applied successfully.');
