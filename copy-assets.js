#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function copyRecursive(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  const entries = readdirSync(src);
  
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    
    if (statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
      console.log(`Copied: ${srcPath} → ${destPath}`);
    }
  }
}

console.log('Copying public assets to dist/public...');
try {
  if (existsSync('public') && existsSync('dist/public')) {
    copyRecursive('public', 'dist/public');
    console.log('✅ Assets copied successfully!');
  } else {
    console.error('❌ Source (public) or destination (dist/public) directory not found');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error copying assets:', error.message);
  process.exit(1);
}