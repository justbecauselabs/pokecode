#!/usr/bin/env node

/**
 * Custom React Native linting script to catch raw text issues
 * This supplements Biome until native React Native support is added
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const REACT_NATIVE_FILE_PATTERNS = ['.tsx', '.ts'];
const EXCLUDED_DIRS = ['node_modules', '.expo', 'dist', 'build', '__tests__'];

/**
 * Patterns that likely indicate raw text in JSX
 */
const RAW_TEXT_PATTERNS = [
  // Direct string literals in JSX
  /\{['"`][^'"`]*['"`]\}/g,
  // Template literals that might resolve to strings  
  /\{\`[^`]*\`\}/g,
  // Variables that might be strings without Text wrapper
  /\{[a-zA-Z_$][a-zA-Z0-9_$]*\}/g,
];

/**
 * Safe patterns that should be ignored
 */
const SAFE_PATTERNS = [
  /className=/,
  /style=/,
  /testID=/,
  /key=/,
  /source=/,
  /uri=/,
  /<Text[^>]*>/,
  /\.map\(/,
  /\.filter\(/,
  /\.reduce\(/,
];

async function getAllFiles(dir, files = []) {
  const items = await readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = join(dir, item.name);
    
    if (item.isDirectory() && !EXCLUDED_DIRS.includes(item.name)) {
      await getAllFiles(fullPath, files);
    } else if (item.isFile() && REACT_NATIVE_FILE_PATTERNS.includes(extname(item.name))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function analyzeFile(content, filePath) {
  const lines = content.split('\n');
  const issues = [];
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    
    // Skip if line contains safe patterns
    if (SAFE_PATTERNS.some(pattern => pattern.test(line))) {
      return;
    }
    
    // Check for potential raw text patterns
    RAW_TEXT_PATTERNS.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Additional filtering to reduce false positives
          if (!match.includes('className') && 
              !match.includes('style') && 
              !match.includes('testID') &&
              !match.includes('key=') &&
              !line.includes('<Text')) {
            issues.push({
              file: filePath,
              line: lineNumber,
              column: line.indexOf(match) + 1,
              content: match,
              fullLine: line.trim(),
              severity: 'warning',
              message: 'Potential raw text that should be wrapped in <Text> component'
            });
          }
        });
      }
    });
  });
  
  return issues;
}

async function lintReactNative() {
  console.log('🔍 Running custom React Native text validation...\n');
  
  const files = await getAllFiles('./src');
  files.push(...await getAllFiles('./app'));
  
  let totalIssues = 0;
  const allIssues = [];
  
  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const issues = analyzeFile(content, file);
      
      if (issues.length > 0) {
        allIssues.push(...issues);
        totalIssues += issues.length;
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message);
    }
  }
  
  // Report results
  if (allIssues.length > 0) {
    console.log('⚠️  Potential React Native text issues found:\n');
    
    allIssues.forEach(issue => {
      console.log(`${issue.file}:${issue.line}:${issue.column}`);
      console.log(`  ${issue.severity}: ${issue.message}`);
      console.log(`  ${issue.fullLine}`);
      console.log(`  ${' '.repeat(issue.column - 1)}${'~'.repeat(issue.content.length)}\n`);
    });
    
    console.log(`Total issues found: ${totalIssues}`);
    console.log('\n💡 Tip: Wrap text content in <Text> components:');
    console.log('   ❌ <View>{someString}</View>');
    console.log('   ✅ <View><Text>{someString}</Text></View>\n');
    
    return totalIssues;
  } else {
    console.log('✅ No React Native text issues found!\n');
    return 0;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  lintReactNative()
    .then(issueCount => {
      process.exit(issueCount > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Error running React Native linter:', error);
      process.exit(1);
    });
}