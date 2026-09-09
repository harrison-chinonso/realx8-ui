/**
 * Design tokens exposed as Tailwind utilities.
 *
 * The neutral ramp and semantic surfaces are fixed; only `primary` follows the
 * company's configured brand colour, which AppearanceContext rewrites at
 * runtime. That split is what lets one codebase serve tenants with very
 * different brand colours without contrast falling apart.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          soft: 'rgba(var(--primary-rgb), 0.10)',
        },
        content: {
          DEFAULT: 'var(--content)',
          muted: 'var(--content-muted)',
          subtle: 'var(--content-subtle)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
          sunken: 'var(--surface-sunken)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        danger: { DEFAULT: 'var(--danger)', surface: 'var(--danger-surface)' },
        success: { DEFAULT: 'var(--success)', surface: 'var(--success-surface)' },
        warning: { DEFAULT: 'var(--warning)', surface: 'var(--warning-surface)' },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        md: 'var(--radius)',
        lg: 'calc(var(--radius) + 2px)',
        xl: 'calc(var(--radius) + 6px)',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
        ui: ['var(--font-ui)'],
      },
      boxShadow: {
        // A single soft elevation, as the reference uses, rather than a ladder.
        card: '0 1px 2px 0 rgb(16 24 40 / 0.05)',
        pop: '0 12px 16px -4px rgb(16 24 40 / 0.08), 0 4px 6px -2px rgb(16 24 40 / 0.03)',
      },
    },
  },
  plugins: [],
};
