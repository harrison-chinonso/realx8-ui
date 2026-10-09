/**
 * What the website assistant knows: Realx8 and its features, nothing else.
 *
 * Every answer is written here on purpose — nothing is generated — so it can
 * never promise a feature the product does not have. Keep it in step with the
 * app (Realx8-Ui); when a feature ships or changes, change its answer here.
 *
 * `match` holds lowercase phrases; longer phrases outrank shorter ones (see
 * engine.js). `chips` are the follow-up suggestions shown after the answer.
 */

export const TOPICS = [
  {
    id: 'overview',
    match: ['what is realx8', 'what does realx8 do', 'what can realx8 do', 'what can it do', 'features', 'capabilities',
      'tell me about realx8', 'what do you offer', 'what is this', 'how does it work', 'overview', 'modules'],
    answer: 'Realx8 runs a property business end to end, under your own brand:\n\n• Property listings and inspections\n• Sales & CRM\n• Your realtor network: levels, commissions, referrals and payouts\n• Invoices, instalment plans and payment approvals\n• Full accounting\n• A client portal\n• Investments, marketing and day-to-day operations\n\nWhat would you like to know more about?',
    chips: ['Realtor commissions', 'Payments & instalments', 'Can it carry my brand?', 'Request onboarding'],
  },
  {
    id: 'who',
    match: ['who is it for', 'who can use', 'is it for me', 'developer', 'developers', 'agency', 'agencies',
      'real estate company', 'realtor network', 'small business', 'big company', 'suitable for'],
    answer: 'Realx8 is built for property developers, real-estate companies, agencies and realtor networks — and for their clients, who get their own portal. A company can start small and switch on more modules as it grows.',
    chips: ['What can Realx8 do?', 'Request onboarding'],
  },
  {
    id: 'properties',
    match: ['property listing', 'listings', 'list properties', 'list my properties', 'estates', 'units', 'plots',
      'inspection', 'inspections', 'promotions', 'offers', 'discount', 'share link', 'property page'],
    answer: 'You list estates and properties with their units, configurations and prices, photos, videos and documents. Clients can book inspections, you can run promotions and offers, and every property has a share link: a buyer can sign up and start a purchase in three steps.',
    chips: ['Payments & instalments', 'Client portal', 'Request onboarding'],
  },
  {
    id: 'crm',
    match: ['crm', 'leads', 'lead', 'deals', 'pipeline', 'follow up', 'sales team', 'tasks', 'sales analytics', 'reports on sales'],
    answer: 'Sales & CRM covers leads and deals in a pipeline, tasks and follow-ups, lead sources and labels, realtor performance and sales analytics.',
    chips: ['Realtor commissions', 'What can Realx8 do?'],
  },
  {
    id: 'commission',
    match: ['commission', 'commissions', 'realtor commission', 'how do realtors earn', 'realtor levels', 'grades', 'payout', 'payouts',
      'pay realtors', 'leaderboard', 'realtor verification'],
    answer: 'You set realtor levels, each with its own commission rate, in commission plans you control. When a sale is paid and approved the commission becomes payable; realtors request payouts from their commission records and you approve and pay them. There is also realtor verification and a leaderboard. Realx8 never holds the money — you pay your realtors directly.',
    chips: ['Referrals', 'Payments & instalments', 'Request onboarding'],
  },
  {
    id: 'referrals',
    match: ['referral', 'referrals', 'refer', 'multi level', 'multilevel', 'downline', 'upline', 'network marketing'],
    answer: 'Realtors get their own referral links. If you switch it on, referral earnings can run across several levels, each with the percentage you set, and they appear as pending until the sale behind them is paid and approved.',
    chips: ['Realtor commissions', 'Request onboarding'],
  },
  {
    id: 'payments',
    match: ['payment', 'payments', 'instalment', 'installment', 'payment plan', 'invoice', 'invoices', 'pay online',
      'proof of payment', 'receipts', 'reminders', 'outright', 'bank transfer', 'paystack', 'card payment'],
    answer: 'Buyers pay outright or on an instalment plan. An invoice is created at purchase; the client pays by bank transfer and uploads proof of payment, or pays online where you have a payment gateway set up. You approve payments, and receipts and payment reminders go out automatically.',
    chips: ['Accounting', 'Client portal', 'Request onboarding'],
  },
  {
    id: 'accounting',
    match: ['accounting', 'ledger', 'books', 'bookkeeping', 'reconciliation', 'bank reconciliation', 'expenses', 'expenditure',
      'payables', 'tax', 'taxes', 'vat', 'statements', 'financial reports', 'period close', 'refunds', 'credit note', 'cash book'],
    answer: 'There is a full ledger behind every sale: bank reconciliation, payables and expenditure, refunds and credit notes, taxes, statements, period close and financial reports. You can also bring in your existing books when you start.',
    chips: ['Payments & instalments', 'Request onboarding'],
  },
  {
    id: 'clients',
    match: ['client portal', 'clients', 'customers', 'buyers', 'my clients see', 'client app', 'customer portal'],
    answer: 'Your clients get their own portal: their properties, invoices, balances, payment history, receipts and documents. They can pay and upload proof of payment from their phone.',
    chips: ['Mobile app', 'Can it carry my brand?', 'Request onboarding'],
  },
  {
    id: 'brand',
    match: ['my brand', 'branding', 'white label', 'whitelabel', 'my logo', 'my colours', 'my colors', 'my name', 'custom domain',
      'carry my brand', 'own brand', 'customise', 'customize', 'look and feel'],
    answer: 'Yes. Your clients and realtors see your company, not ours: your name, logo, colours and browser icon on every screen, your own email designs, your help pages and contacts, and your own mobile app.',
    chips: ['Mobile app', 'Request onboarding'],
  },
  {
    id: 'mobile',
    match: ['mobile app', 'app store', 'play store', 'android', 'iphone', 'ios', 'phone app', 'app'],
    answer: 'Realx8 works on any phone browser, and there is a mobile app for Android and iPhone that can be branded as your company\'s own app, with push notifications.',
    chips: ['Notifications', 'Can it carry my brand?', 'Request onboarding'],
  },
  {
    id: 'notifications',
    match: ['notification', 'notifications', 'alerts', 'sms', 'email notifications', 'push notification', 'whatsapp'],
    answer: 'Each event — a payment approved, an invoice due, a commission paid — can go out in-app, by email, as a push notification, or by SMS through your own SMS provider. You choose the channels per event.',
    chips: ['Payments & instalments', 'Request onboarding'],
  },
  {
    id: 'investments',
    match: ['investment', 'investments', 'investors', 'returns', 'roi'],
    answer: 'You can record investments and manage their payment schedules alongside your property sales. Realx8 records and tracks them; it does not offer or guarantee returns itself.',
    chips: ['Accounting', 'Request onboarding'],
  },
  {
    id: 'operations',
    match: ['training', 'courses', 'lms', 'recruitment', 'hiring', 'visitor', 'attendance', 'support centre', 'support center',
      'tickets', 'marketing', 'blog', 'social media', 'content'],
    answer: 'Beyond sales and finance there is training and courses for your team, recruitment, a visitor log and attendance, a support centre, VIP clients, messaging, content posts, a blog and social media accounts.',
    chips: ['What can Realx8 do?', 'Request onboarding'],
  },
  {
    id: 'security',
    match: ['security', 'secure', 'safe', 'privacy', 'data protection', 'permissions', 'roles', 'audit', 'two factor', '2fa', 'who can see'],
    answer: 'Access is by roles and permissions, every change is in an audit trail, and sign-in supports two-factor authentication and a passcode, with one active device per account. Your company\'s data is kept to your company.',
    chips: ['Request onboarding'],
  },
  {
    id: 'pricing',
    match: ['price', 'pricing', 'cost', 'how much', 'fee', 'fees', 'subscription', 'plans', 'free trial', 'trial', 'charge'],
    answer: 'Pricing depends on your setup and size, so our team quotes it for you. I can raise an enquiry and they will get back to you.',
    chips: ['Raise an enquiry', 'Request onboarding'],
  },
  {
    id: 'onboarding-how',
    match: ['how do i start', 'get started', 'how long', 'setup', 'set up', 'onboarding process', 'migrate', 'import my data', 'move my data'],
    answer: 'Getting started takes four steps: tell us about your business, we set up your company (code, brand, admin account and modules), you bring in your team, properties and existing records, then you share your sign-up link and go live. Shall I raise an onboarding request for you?',
    chips: ['Request onboarding', 'Raise an enquiry'],
  },
];

export const GREETING = 'Hi! I can answer questions about Realx8 and what it can do for your property business. I can also raise an onboarding request or an enquiry for you.';
export const GREETING_CHIPS = ['What can Realx8 do?', 'Realtor commissions', 'Can it carry my brand?', 'How much does it cost?', 'Request onboarding'];

export const OFF_TOPIC = 'I can only help with questions about Realx8 and its features. If your question is about Realx8 and I could not answer it, I can raise an enquiry and our team will reply.';
