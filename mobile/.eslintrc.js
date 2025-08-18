module.exports = {
  root: true,
  extends: [
    '@react-native',
    'plugin:react-native/all',
  ],
  plugins: [
    'react-native',
  ],
  rules: {
    // PRIMARY RULE: Prevent strings outside Text components
    'react-native/no-raw-text': ['error', {
      // Add your custom text components here if you have any
      skip: ['CustomText', 'StyledText', 'ThemedText'], 
    }],
    
    // Additional React Native specific rules
    'react-native/no-unused-styles': 'error',
    'react-native/split-platform-components': 'error',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-single-element-style-arrays': 'error',
    
    // Disable rules that might conflict with Biome
    'prettier/prettier': 'off',
    'semi': 'off',
    'quotes': 'off',
    'comma-dangle': 'off',
    'indent': 'off',
    'object-curly-spacing': 'off',
    'space-before-function-paren': 'off',
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+
    
    // Override other formatting rules that Biome handles
    '@typescript-eslint/semi': 'off',
    '@typescript-eslint/quotes': 'off',
    '@typescript-eslint/comma-dangle': 'off',
    '@typescript-eslint/indent': 'off',
  },
  env: {
    'react-native/react-native': true,
  },
  // Only run ESLint on React Native specific files
  overrides: [
    {
      files: ['**/*.tsx', '**/*.ts'],
      excludedFiles: ['**/*.test.*', '**/*.spec.*'],
    },
  ],
};