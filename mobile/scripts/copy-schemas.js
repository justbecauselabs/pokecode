#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../../backend/src/schemas');
const targetDir = path.join(__dirname, '../src/schemas');

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy schema files
const schemaFiles = fs.readdirSync(sourceDir).filter(file => file.endsWith('.schema.ts'));

schemaFiles.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  
  console.log(`Copying ${file}...`);
  fs.copyFileSync(sourcePath, targetPath);
});

console.log(`✅ Copied ${schemaFiles.length} schema files to mobile/src/schemas`);