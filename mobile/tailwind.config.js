/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        terminal: {
          background: '#1a1a1a',
          surface: '#2a2a2a', 
          text: '#f8f8f2',
          comment: '#6272a4',
          keyword: '#bd93f9',
          string: '#50fa7b',
          function: '#8be9fd',
          number: '#ff79c6',
          variable: '#ffb86c',
          error: '#ff5555',
          success: '#50fa7b',
          warning: '#f1fa8c',
          info: '#8be9fd',
        },
      },
      fontFamily: {
        mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};

