/**
 * The banks a Nigerian company's statement can come from.
 *
 * ── What this list is FOR ───────────────────────────────────────────────────
 *
 * Naming the bank a statement came from, so the column mapping worked out on
 * the first import is reused on every one after it. It is not a payments
 * directory and nothing transfers money using anything here.
 *
 * ── Why some entries carry a code and some do not ───────────────────────────
 *
 * The codes on the entries below came from the company's own authoritative
 * list and are reproduced exactly. The banks added beside them carry NO code,
 * deliberately: a bank code is the sort of thing that gets reused for a
 * transfer later, and a plausible-looking wrong one is far more dangerous than
 * an absent one. They can be filled in from NIBSS when somebody has the real
 * list in front of them.
 *
 * ── The ones that no longer trade ───────────────────────────────────────────
 *
 * Diamond was absorbed into Access in 2019; Enterprise and MainStreet were
 * absorbed before that; Skye became Polaris. They are kept, because statements
 * from those years still exist and still need importing — but they are marked,
 * and the picker puts them at the bottom under their own heading so nobody
 * chooses one for an account opened last week.
 */

/** [name, short code, NIBSS code or null, no longer trading] */
export const NIGERIAN_BANKS = [
  // ── Commercial banks ─────────────────────────────────────────────────────
  { name: 'Access Bank Nigeria Plc', short: 'ABP', code: '044' },
  { name: 'Citibank Nigeria Limited', short: 'CITY', code: '023' },
  { name: 'Ecobank Nigeria', short: 'ECO', code: '050' },
  { name: 'Fidelity Bank Plc', short: 'FBP', code: '070' },
  { name: 'First Bank of Nigeria Plc', short: 'FBN', code: '011' },
  { name: 'First City Monument Bank', short: 'FCMB', code: '214' },
  { name: 'Globus Bank', short: 'Globus', code: '000027' },
  { name: 'Guaranty Trust Bank Limited', short: 'GTB', code: '058' },
  { name: 'Heritage Bank', short: 'HER', code: '030' },
  { name: 'Jaiz Bank', short: 'JAIZ', code: '301' },
  { name: 'Keystone Bank Limited', short: 'KSB', code: '082' },
  { name: 'Lotus Bank', short: 'LOTUS BANK', code: '000029' },
  { name: 'Optimus Bank', short: 'OPTIMUS', code: '000036' },
  { name: 'Parallex Bank', short: 'PAR', code: '104' },
  { name: 'Polaris Bank', short: 'SKYE', code: '076' },
  { name: 'Providus Bank', short: 'PBL', code: '101' },
  { name: 'Signature Bank', short: 'Signature', code: '000034' },
  { name: 'Stanbic IBTC Bank Plc', short: 'STANBIC', code: '221' },
  { name: 'Standard Chartered Bank', short: 'SCB', code: '068' },
  { name: 'Sterling Bank Plc', short: 'SBP', code: '232' },
  { name: 'SunTrust Bank', short: 'SUNTRUST', code: '100' },
  { name: 'TAJ Bank', short: 'TAJ', code: '302' },
  { name: 'The Alternative Bank', short: 'ALTBANK', code: '000304' },
  { name: 'Union Bank Nigeria Plc', short: 'UBN', code: '032' },
  { name: 'United Bank for Africa Plc', short: 'UBA', code: '033' },
  { name: 'Unity Bank Plc', short: 'UNITY', code: '215' },
  { name: 'WEMA Bank Plc', short: 'WEMA', code: '035' },
  { name: 'Zenith Bank International', short: 'ZIB', code: '057' },
  // Added — code withheld until confirmed, see the note above.
  { name: 'Titan Trust Bank', short: 'TITAN', code: null },
  { name: 'PremiumTrust Bank', short: 'PREMIUM', code: null },

  // ── Merchant banks ───────────────────────────────────────────────────────
  { name: 'Coronation Merchant Bank', short: 'Coronation', code: '060001' },
  { name: 'FSDH Merchant Bank Limited', short: 'FSDH', code: '400001' },
  { name: 'NOVA Commercial Bank', short: 'NOVA', code: '060003' },
  { name: 'Summit Bank', short: 'Summit', code: '080003' },
  { name: 'Greenwich Merchant Bank', short: 'GREENWICH', code: null },
  { name: 'Rand Merchant Bank', short: 'RMB', code: null },

  // ── Payment service banks and fintechs ───────────────────────────────────
  { name: 'Paycom (OPay)', short: 'OPAY', code: '100004' },
  { name: 'PalmPay', short: 'PALMPAY', code: '100033' },
  { name: 'Moniepoint', short: 'Monie Point', code: '090405' },
  { name: 'MoMo Payment Service Bank', short: 'MOMO', code: '120003' },
  { name: 'Kuda Bank', short: 'KUDA', code: null },
  { name: 'Paga', short: 'PAGA', code: null },
  { name: 'Carbon', short: 'CARBON', code: null },

  // ── Microfinance and mortgage banks ──────────────────────────────────────
  { name: '9jaPay Microfinance Bank', short: '9jaPay', code: '090629' },
  { name: 'AB Microfinance Bank', short: 'ABM', code: '090270' },
  { name: 'Abbey Mortgage Bank', short: 'ABBEY', code: '070010' },
  { name: 'Berachah Microfinance Bank', short: 'Berachah', code: '090618' },
  { name: 'Build Microfinance Bank', short: 'Build', code: '090613' },
  { name: 'Kredi Bank', short: 'KREDI BANK', code: '090380' },
  { name: 'Nigerian Navy Microfinance Bank Limited', short: 'NNMFB', code: '090263' },
  { name: 'RenMoney Microfinance Bank', short: 'RenMoney', code: '090198' },
  { name: 'Safe Haven Microfinance Bank', short: 'SAFEHAVEN MFB', code: '090286' },
  { name: 'VFD Microfinance Bank', short: 'VFD', code: '090110' },
  { name: 'Accion Microfinance Bank', short: 'ACCION', code: null },
  { name: 'FairMoney Microfinance Bank', short: 'FAIRMONEY', code: null },
  { name: 'LAPO Microfinance Bank', short: 'LAPO', code: null },
  { name: 'Rubies Microfinance Bank', short: 'RUBIES', code: null },
  { name: 'Sparkle Microfinance Bank', short: 'SPARKLE', code: null },

  // ── No longer trading, kept for older statements ─────────────────────────
  { name: 'Diamond Bank Plc', short: 'DBP', code: '063', former: 'merged into Access Bank, 2019' },
  { name: 'Enterprise Bank', short: 'ENT', code: '084', former: 'absorbed by Heritage Bank' },
  { name: 'MainStreet Bank', short: 'MSB', code: '014', former: 'absorbed by Skye Bank' },
];

/** Trading banks first, alphabetically; the defunct ones last. */
export const bankOptions = () => {
  const alive = NIGERIAN_BANKS.filter((bank) => !bank.former)
    .sort((a, b) => a.name.localeCompare(b.name));
  const gone = NIGERIAN_BANKS.filter((bank) => bank.former)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { alive, gone };
};

/** Whether a name is one we already know, however it was typed. */
export const isKnownBank = (name) => NIGERIAN_BANKS.some(
  (bank) => bank.name.toLowerCase() === String(name || '').trim().toLowerCase(),
);

export default NIGERIAN_BANKS;
