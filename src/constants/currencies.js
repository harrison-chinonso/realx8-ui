/**
 * Currencies an admin can pick from.
 *
 * Only the CODE is ever stored. The symbol shown throughout the app is derived
 * from it at render time via Intl (`narrowSymbol`), so choosing NGN produces ₦
 * everywhere without anyone typing a symbol — and the two can never disagree.
 * The signs below are display hints for this list only.
 */
export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', sign: '$' },
  { code: 'EUR', label: 'Euro', sign: '€' },
  { code: 'GBP', label: 'British Pound', sign: '£' },
  { code: 'NGN', label: 'Nigerian Naira', sign: '₦' },
  { code: 'GHS', label: 'Ghanaian Cedi', sign: '₵' },
  { code: 'KES', label: 'Kenyan Shilling', sign: 'KSh' },
  { code: 'ZAR', label: 'South African Rand', sign: 'R' },
  { code: 'CAD', label: 'Canadian Dollar', sign: 'C$' },
  { code: 'AUD', label: 'Australian Dollar', sign: 'A$' },
  { code: 'AED', label: 'UAE Dirham', sign: 'د.إ' },
  { code: 'INR', label: 'Indian Rupee', sign: '₹' },
  { code: 'JPY', label: 'Japanese Yen', sign: '¥' },
  { code: 'CHF', label: 'Swiss Franc', sign: 'Fr' },
  { code: 'SAR', label: 'Saudi Riyal', sign: '﷼' },
  { code: 'EGP', label: 'Egyptian Pound', sign: 'E£' },
  { code: 'XOF', label: 'West African CFA Franc', sign: 'CFA' },
];

/** "NGN — Nigerian Naira (₦)" */
export const currencyOptionLabel = ({ code, label, sign }) => `${code} — ${label} (${sign})`;
