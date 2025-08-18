/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // One Dark Pro color palette - comprehensive token system
        background: '#282c34',
        foreground: '#abb2bf',
        card: {
          DEFAULT: '#21252b',
          foreground: '#abb2bf',
        },
        popover: {
          DEFAULT: '#21252b',
          foreground: '#abb2bf',
        },
        primary: {
          DEFAULT: '#528bff',
          dark: '#0052A3',
          light: '#3385FF',
          foreground: '#282c34',
        },
        secondary: {
          DEFAULT: '#3e4451',
          foreground: '#abb2bf',
        },
        muted: {
          DEFAULT: '#21252b',
          foreground: '#9da5b4',
        },
        accent: {
          DEFAULT: '#98c379',
          foreground: '#282c34',
        },
        destructive: {
          DEFAULT: '#e06c75',
          foreground: '#abb2bf',
        },
        border: '#3e4451',
        input: '#21252b',
        ring: '#528bff',

        // Status colors
        warning: '#d19a66',
        success: '#98c379',
        info: '#56b6c2',
        error: '#e06c75',

        // Message type colors
        'message-user': '#528bff',
        'message-assistant': '#98c379', 
        'message-system': '#d19a66',
        'message-result': '#e06c75',

        // Syntax highlighting
        'syntax-keyword': '#c678dd',
        'syntax-string': '#98c379',
        'syntax-comment': '#5c6370',
        'syntax-number': '#d19a66',
        'syntax-function': '#61dafb',
        'syntax-variable': '#e06c75',

        // Additional utility colors
        'indicator-primary': '#528bff',
        'indicator-loading': '#6366f1',
        'indicator-success': '#22c55e',
        'indicator-warning': '#f59e0b',
        'indicator-error': '#ef4444',
        'indicator-offline': '#94a3b8',

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
        message: '8px',
        tool: '12px',
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Menlo', 'Courier New', 'monospace'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Menlo', 'Courier New', 'monospace'],
      },
      fontSize: {
        'code': ['14px', { lineHeight: '20px' }],
        'code-sm': ['12px', { lineHeight: '16px' }],
        'header': ['12px', { lineHeight: '16px', fontWeight: '600' }],
        'message': ['16px', { lineHeight: '24px' }],
        'message-sm': ['14px', { lineHeight: '20px' }],
      },
      spacing: {
        'message': '12px',
        'section': '24px',
      },
      minHeight: {
        'button-sm': '32px',
        'button': '44px', 
        'button-lg': '56px',
        'input': '44px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [],
};
