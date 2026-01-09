#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../../../custom_components/cafe/www'); // extra set of '../' due to being in scripts/
const assetsDir = path.join(targetDir, 'assets');
const indexFile = path.join(targetDir, 'index.html');

// Create directory if it doesn't exist
fs.mkdirSync(targetDir, { recursive: true });

// Remove assets directory
if (fs.existsSync(assetsDir)) {
  fs.rmSync(assetsDir, { recursive: true, force: true });
}

// Remove index.html
if (fs.existsSync(indexFile)) {
  fs.unlinkSync(indexFile);
}

console.log('Cleaned Home Assistant web files from custom_components/cafe/www');
