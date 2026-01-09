/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          DEFAULT: '#0b57d0',
          light: '#4285f4',
          dark: '#084298',
        },
        success: {
          light: '#d1e7dd',
          DEFAULT: '#28a745',
          dark: '#155724',
        },
        error: {
          light: '#f8d7da',
          DEFAULT: '#dc3545',
          dark: '#721c24',
        },
        warning: {
          light: '#fff3cd',
          DEFAULT: '#ffc107',
          dark: '#856404',
        },
        // Dark mode colors
        dark: {
          bg: '#1a1a1a',
          'bg-soft': '#2d2d2d',
          'bg-card': '#333333',
          text: '#e5e5e5',
          'text-muted': '#a0a0a0',
          border: '#404040',
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'medium': '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'large': '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        'focus': '0 0 0 3px rgba(11, 87, 208, 0.1), 0 2px 4px rgba(0, 0, 0, 0.12)',
        'hover': '0 2px 4px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      },
    },
  },
  plugins: [],
}
