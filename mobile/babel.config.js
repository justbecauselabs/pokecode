module.exports = (api) => {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            // Prefer source from workspace packages over prebuilt dist
            '@pokecode/api': '../packages/api/src',
            '@pokecode/types': '../packages/types/src',
          },
        },
      ],
      // reanimated plugin is included by nativewind preset to ensure correct order
    ],
  };
};
