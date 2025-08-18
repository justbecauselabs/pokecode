#!/bin/bash

echo "🚀 Setting up React Native linting to prevent text rendering errors..."

# Install dependencies
echo "📦 Installing ESLint and React Native linting dependencies..."
bun add -D eslint @react-native/eslint-config eslint-plugin-react-native husky

# Setup husky hooks
echo "🪝 Setting up Git hooks..."
bunx husky install
bunx husky add .husky/pre-commit "cd mobile && bun run lint:rn && bun run type-check"

# Make scripts executable
chmod +x scripts/custom-react-native-linter.js
chmod +x .husky/pre-commit

echo "✅ Setup complete!"
echo ""
echo "📋 Available commands:"
echo "  bun run lint:rn         - Run React Native ESLint rules"
echo "  bun run lint:rn:fix     - Auto-fix React Native issues"
echo "  bun run lint:rn:custom  - Run custom text validation"
echo "  bun run lint            - Run both Biome and React Native linting"
echo ""
echo "🛡️  Your codebase now has multiple layers of protection against"
echo "   'strings must be rendered in text component' errors!"