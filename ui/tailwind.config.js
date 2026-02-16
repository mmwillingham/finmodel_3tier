/** @type {import('tailwindcss').Config} */
/** Design system: Design_System_for_Fintech_SaaS (Figma Make export) */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fintech design system: Navy, Teal, Gold
        navy: {
          50: '#e8eef4',
          100: '#c5d4e4',
          200: '#9fb8d1',
          300: '#789cbe',
          400: '#5a87b0',
          500: '#3d73a3',
          600: '#2d5a85',
          700: '#1f4266',
          800: '#152d47',
          900: '#0F2847', // Primary Navy
        },
        teal: {
          50: '#e6f7fc',
          100: '#b3e7f6',
          200: '#80d7f0',
          300: '#4dc7ea',
          400: '#26bae5',
          500: '#00a3e0', // Primary Teal
          600: '#0082b8',
          700: '#006290',
          800: '#004168',
          900: '#002140',
        },
        gold: {
          50: '#fbf6f0',
          100: '#f5e6d9',
          200: '#ecd4bc',
          300: '#e2c29f',
          400: '#dbb388',
          500: '#d4a574', // Accent Gold
          600: '#b88a5a',
          700: '#9a7047',
          800: '#7c5736',
          900: '#5e3f26',
        },
        // Semantic surfaces (use with CSS vars for light/dark)
        surface: {
          DEFAULT: 'var(--surface)',
          card: 'var(--surface-card)',
          elevated: 'var(--surface-elevated)',
        },
        fg: {
          DEFAULT: 'var(--fg)',
          muted: 'var(--fg-muted)',
        },
        // Legacy / compatibility
        primary: {
          50: '#e6f7fc',
          100: '#b3e7f6',
          200: '#80d7f0',
          300: '#4dc7ea',
          400: '#26bae5',
          500: '#00a3e0',
          600: '#0082b8',
          700: '#006290',
          800: '#004168',
          900: '#0F2847',
        },
        accent: {
          DEFAULT: '#00a3e0',
          light: '#26bae5',
          dark: '#006290',
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
        dark: {
          bg: '#0d1117',
          'bg-soft': '#161b22',
          'bg-card': '#161b22',
          text: '#e6edf3',
          'text-muted': '#8b949e',
          border: '#30363d',
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        'base': '8px', // 8px grid
      },
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '6px',
        'xl': '12px',
        '2xl': '16px',
        'modal': '12px',
        'hero': '16px',
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'medium': '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'large': '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        'focus': '0 0 0 3px rgba(0, 163, 224, 0.35)',
        'focus-ring': '0 0 0 3px rgba(0, 163, 224, 0.35)',
        'hover': '0 2px 4px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      },
      backgroundImage: {
        'gradient-nav-teal': 'linear-gradient(135deg, #0F2847 0%, #00a3e0 100%)',
      },
    },
  },
  plugins: [],
}
