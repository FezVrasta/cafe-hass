#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../dist');
const targetDir = path.join(__dirname, '../../../custom_components/cafe/www'); // extra set of '../' due to being in scripts/

function copyRecursive(src, dest) {
  // Create destination directory
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  copyRecursive(sourceDir, targetDir);
  console.log('Copied distribution files to: custom_components/cafe/www');
} catch (error) {
  console.error('Error copying files:', error.message);
  process.exit(1);
}

