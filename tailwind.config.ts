import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-muted': 'var(--surface-muted)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        'ink-muted': 'var(--ink-muted)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        systolic: 'var(--series-systolic)',
        diastolic: 'var(--series-diastolic)',
        pulse: 'var(--series-pulse)',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
