/**
 * fonts.js — single source of truth for all font options and categories.
 * Kept in a plain (non-component) file so Vite Fast Refresh stays happy.
 */

export const FONT_CATALOGUE = [
  {
    name: 'Tomato Grotesk',
    url: 'https://api.fontshare.com/v2/css?f[]=tomato-grotesk@400,500,600,700&display=swap',
    stack: "'Tomato Grotesk', sans-serif",
    tag: 'Display',
  },
  {
    name: 'Inter',
    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    stack: "'Inter', sans-serif",
    tag: 'Modern',
  },
  {
    name: 'Poppins',
    url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
    stack: "'Poppins', sans-serif",
    tag: 'Rounded',
  },
  {
    name: 'Roboto',
    url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    stack: "'Roboto', sans-serif",
    tag: 'Classic',
  },
  {
    name: 'Lato',
    url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
    stack: "'Lato', sans-serif",
    tag: 'Clean',
  },
  {
    name: 'Nunito',
    url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap',
    stack: "'Nunito', sans-serif",
    tag: 'Friendly',
  },
  {
    name: 'System Sans',
    url: null,
    stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    tag: 'System',
  },
];

export const FONT_CATEGORIES = [
  {
    key: 'font_heading',
    label: 'Headings',
    description: 'h1 – h4 titles and section headers',
    cssVar: '--font-heading',
  },
  {
    key: 'font_body',
    label: 'Body Text',
    description: 'Paragraphs, lists, table cells and general content',
    cssVar: '--font-body',
  },
  {
    key: 'font_ui',
    label: 'UI & Interface',
    description: 'Buttons, form labels, inputs, navigation and badges',
    cssVar: '--font-ui',
  },
];

/** Return the CSS font-stack string for a given font name */
export function fontStack(name) {
  const entry = FONT_CATALOGUE.find((f) => f.name === name);
  return entry ? entry.stack : `'${name}', sans-serif`;
}
