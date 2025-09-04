const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Ensure Metro watches monorepo root so it can load package sources
const monorepoRoot = path.resolve(__dirname, '..');
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), monorepoRoot]));

// Follow symlinks and respect package exports conditions
config.resolver = {
  ...(config.resolver || {}),
  unstable_enableSymlinks: true,
  unstable_enablePackageExports: true,
};

module.exports = withNativeWind(config, { input: './global.css' });
