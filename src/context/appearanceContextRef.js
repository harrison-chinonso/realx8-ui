// Plain JS — context object only, no JSX. Keeps AppearanceContext.jsx Fast-Refresh-compatible
// (Vite requires .jsx files to export only React components).
import { createContext } from 'react';

export const AppearanceContext = createContext({
  app_name: '',
  app_logo: null,
  primary_color: '#1e3a8a',
  secondary_color: '#0f172a',
  dark_primary_color: null,
  dark_secondary_color: null,
  font_heading: 'Tomato Grotesk',
  font_body: 'Inter',
  font_ui: 'Inter',
  font_family: 'Inter',
  dark_mode: 'off',
  currency: 'USD',
  template: 'classic',
  nameLoaded: false,
});
