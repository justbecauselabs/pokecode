/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // One Dark Pro color palette - direct color values for React Native compatibility
        background: '#282c34', // One Dark background
        foreground: '#abb2bf', // One Dark foreground text
        card: {
          DEFAULT: '#21252b', // Slightly darker card background
          foreground: '#abb2bf', // Same as foreground
        },
        popover: {
          DEFAULT: '#21252b',
          foreground: '#abb2bf',
        },
        primary: {
          DEFAULT: '#528bff', // One Dark blue (accent)
          foreground: '#282c34', // Dark text on blue background
        },
        secondary: {
          DEFAULT: '#3e4451', // Darker secondary
          foreground: '#abb2bf',
        },
        muted: {
          DEFAULT: '#21252b', // Subtle backgrounds
          foreground: '#9da5b4', // Muted text
        },
        accent: {
          DEFAULT: '#98c379', // One Dark green
          foreground: '#282c34',
        },
        destructive: {
          DEFAULT: '#e06c75', // One Dark red
          foreground: '#abb2bf',
        },
        border: '#3e4451', // Subtle borders
        input: '#21252b', // Input backgrounds
        ring: '#528bff', // Focus rings

        // Terminal-specific colors for syntax highlighting
        terminal: {
          cursor: '#528bff',
          selection: '#abb2bf33', // With opacity
          prompt: '#98c379', // Green prompt
          error: '#e06c75', // Red for errors
          warning: '#d19a66', // Orange for warnings
          info: '#56b6c2', // Cyan for info
          string: '#98c379', // Green for strings
          number: '#d19a66', // Orange for numbers
          keyword: '#c678dd', // Purple for keywords
        },

        // Status colors
        warning: '#d19a66',
        success: '#98c379',
        info: '#56b6c2',

        // Light mode colors (fallback)
        'background-light': '#ffffff',
        'foreground-light': '#1a1a1a',
        'card-light': '#ffffff',
        'border-light': '#e5e5e5',
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '4px',
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Menlo', 'Courier New', 'monospace'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Menlo', 'Courier New', 'monospace'],
      },
    },
  },
  darkMode: 'class', // Enable class-based dark mode
  plugins: [],
};
