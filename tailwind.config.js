/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      // AXA x Teenage Engineering Design System
      colors: {
        // Teenage Engineering - Industrial Base
        'te': {
          'bg': '#F5F5F0',           // Matte off-white
          'bg-dark': '#E8E8E0',      // Slightly darker shade
          'border': '#1A1A1A',       // Industrial black borders
          'border-light': '#D0D0D0', // Subtle grid lines
          'text': '#0A0A0A',         // Near-black text
          'text-muted': '#6B6B6B',   // Muted text
        },
        // AXA Corporate Colors
        'axa': {
          'blue': '#00008F',         // Primary action color
          'blue-dark': '#000066',    // Hover state
          'blue-light': '#3333A3',   // Light variant
          'red': '#FF1721',          // Accent / Danger
          'red-dark': '#CC0000',     // Danger hover
          'white': '#FFFFFF',        // Pure white for contrast
        },
        // Semantic Colors
        'log': {
          'error': '#FF172115',      // Error row tint (very subtle)
          'warn': '#FFA50015',       // Warning row tint
          'info': '#00008F10',       // Info row tint
          'debug': '#9B9B9B10',      // Debug row tint
        }
      },
      fontFamily: {
        // Industrial Monospace for data/logs
        'mono': ['JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
        // Corporate Sans-Serif for headers
        'sans': ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // Compact industrial sizing
        'xxs': ['0.65rem', { lineHeight: '1rem' }],
        'data': ['0.75rem', { lineHeight: '1.25rem' }],
      },
      borderWidth: {
        '1': '1px',
      },
      spacing: {
        // Grid-aligned spacing
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
      },
      boxShadow: {
        'industrial': 'inset 0 0 0 1px var(--color-te-border)',
        'panel': '2px 2px 0 0 var(--color-te-border)',
      },
      animation: {
        'pulse-blue': 'pulse-blue 2s ease-in-out infinite',
        'diagonal-stripe': 'diagonal-stripe 1s linear infinite',
      },
      keyframes: {
        'pulse-blue': {
          '0%, 100%': { borderColor: 'var(--color-axa-blue)' },
          '50%': { borderColor: 'var(--color-axa-blue-light)' },
        },
        'diagonal-stripe': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '14px 14px' },
        }
      },
    },
  },
  plugins: [],
}
