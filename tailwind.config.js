/** @type {import('tailwindcss').Config} */
// ─── GreenLab Design Tokens ───────────────────────────────────────────────────
// Mantido enxuto pra não pesar o build. Toda paleta semântica abaixo aliasa
// pros valores hex da marca; mude aqui pra repintar o app inteiro.

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde da logo GreenLab — gradiente de emerald a lime,
        // calibrado pra contraste em dark mode.
        brand: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#22c55e',  // verde principal (CTA, links ativos)
          600: '#16a34a',  // hover/pressed
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
      },
      // Sombras "premium" — sutis, dar profundidade sem peso visual.
      boxShadow: {
        'soft':   '0 1px 2px 0 rgb(0 0 0 / 0.30), 0 1px 3px 0 rgb(0 0 0 / 0.20)',
        'raised': '0 4px 12px -2px rgb(0 0 0 / 0.40), 0 2px 4px -2px rgb(0 0 0 / 0.30)',
        'glow':   '0 0 0 1px rgb(34 197 94 / 0.30), 0 0 24px -4px rgb(34 197 94 / 0.25)',
      },
      // Animações pra microinterações
      animation: {
        'fade-in':       'fadeIn 200ms ease-out',
        'pulse-subtle':  'pulseSubtle 2s ease-in-out infinite',
        'shimmer':       'shimmer 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        pulseSubtle:  { '0%, 100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
        shimmer:      { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
