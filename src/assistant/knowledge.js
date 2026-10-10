/**
 * What the website assistant knows: Realx8 and its features, nothing else.
 *
 * Every answer is written here on purpose — nothing is generated — so it can
 * never promise a feature the product does not have. Keep it in step with the
 * app (Realx8-Ui); when a feature ships or changes, change its answer here.
 *
 * `match` holds lowercase phrases; longer phrases outrank shorter ones (see
 * engine.js). `chips` are the follow-up suggestions shown after the answer.
 * `offer` names the request a plain "yes" to the answer starts.
 *
 * Prices come from the same list as the pricing page: the built-in copy in
 * content/plans.js until the site has fetched the app's own plans
 * (GET /public/plans), then those — set here by the chat window through
 * setPlans. A plan added or re-priced in the app is in these answers on the
 * next visit, with no redeploy.
 */
import {
  GRACE_DAYS, PLANS, TRIAL_DAYS, annualSavingPercent, formatNaira, formatPercent, userLimitLabel,
} from '../content/plans.js';

let livePlans = PLANS;
/** The plans the assistant quotes; the chat window passes the fetched list. */
export const setPlans = (plans) => { if (Array.isArray(plans) && plans.length) livePlans = plans; };
export const currentPlans = () => livePlans;

const planLines = () => livePlans
  .map((p) => `• ${p.name} — ${formatNaira(p.monthly_price)}/month or ${formatNaira(p.annual_price)}/year · ${userLimitLabel(p).toLowerCase()}`)
  .join('\n');
const bestSaving = () => formatPercent(Math.max(0, ...livePlans.map(annualSavingPercent)));

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
    match: ['price', 'prices', 'pricing', 'cost', 'costs', 'how much', 'fee', 'fees', 'subscription', 'plans', 'plan', 'charge',
      'starter', 'professional', 'enterprise', 'per month', 'per year', 'annual', 'monthly', 'yearly', 'naira'],
    answer: () => `Every plan includes all Realx8 features; they differ only by how many users your company has:\n\n${planLines()}\n\nPaying annually saves up to ${bestSaving()}. Every new company also starts with a ${TRIAL_DAYS}-day free trial — all features, no user limit, no card needed. The Pricing page has the details.`,
    chips: ['Start free trial', 'What counts as a user?', 'Request onboarding'],
  },
  {
    id: 'trial',
    match: ['free trial', 'trial', 'trial period', 'how long is the trial', 'how long is the free trial', 'is there a free trial',
      'try for free', 'try it free', 'try before', 'free', 'card needed', 'need a card', 'credit card', 'card details', 'no card'],
    answer: `Every new company gets a ${TRIAL_DAYS}-day free trial with every feature and no user limit, and no card is needed to start. Our team sets up your company and the ${TRIAL_DAYS} days start the day it is created. Shall I start it for you?`,
    chips: ['Start free trial', 'What happens after the trial?', 'How much does it cost?'],
    offer: 'trial',
  },
  {
    id: 'users',
    match: ['users', 'user', 'user limit', 'how many users', 'number of users', 'what counts as a user', 'count as a user',
      'counts as a user', 'count as users', 'seats', 'user accounts', 'do clients count', 'do realtors count', 'unlimited users'],
    answer: () => `A user is any user account in your company — staff, realtors and clients alike — counted together, per company.\n\n${livePlans.map((p) => `• ${p.name}: ${userLimitLabel(p).toLowerCase()}`).join('\n')}\n\nThe free trial has no user limit.`,
    chips: ['How much does it cost?', 'Can I switch plans?', 'Start free trial'],
  },
  {
    id: 'lapse',
    match: ['after the trial', 'trial ends', 'trial expires', 'end of the trial', 'expire', 'expires', 'expired', 'lapse', 'lapsed',
      'grace period', 'grace', 'read only', 'missed', 'miss a payment', 'missed payment', 'payment is missed', 'dont pay', 'do not pay',
      'stop paying', 'late payment', 'not renew', 'subscription ends', 'overdue subscription'],
    answer: `When a trial or a paid period ends without payment, there are ${GRACE_DAYS} days of grace, then your company becomes read-only until you renew. While it is read-only your clients can still pay and your realtors can still share property links, and anyone who signs up waits in a queue that is completed automatically when you renew.`,
    chips: ['How do I pay for Realx8?', 'How much does it cost?'],
  },
  {
    id: 'switch-plan',
    match: ['switch plan', 'switch plans', 'change plan', 'change my plan', 'change plans', 'upgrade', 'upgrading', 'downgrade',
      'downgrading', 'move to another plan', 'bigger plan', 'more users', 'outgrow', 'monthly to annual', 'annual to monthly'],
    answer: 'Yes. Every plan has the same features, so switching only changes your user limit and price. Our team moves you to another plan, or between monthly and annual billing — I can raise an enquiry for you.',
    chips: ['Raise an enquiry', 'How much does it cost?'],
    offer: 'enquiry',
  },
  {
    id: 'pay-subscription',
    match: ['pay for realx8', 'pay for the subscription', 'pay the subscription', 'pay for my plan',
      'payment method', 'payment methods', 'pay for it', 'renew', 'renewal', 'renewals', 'auto renew', 'automatic renewal', 'subscription payment'],
    answer: 'You pay for Realx8 by card or bank through Paystack, or by bank transfer arranged with our team, monthly or annually. Renewals can be automatic.',
    chips: ['What happens if a payment is missed?', 'How much does it cost?'],
  },
  {
    id: 'onboarding-how',
    match: ['how do i start', 'get started', 'how long', 'setup', 'set up', 'onboarding process', 'migrate', 'import my data', 'move my data'],
    answer: 'Getting started takes four steps: tell us about your business, we set up your company (code, brand, admin account and modules), you bring in your team, properties and existing records, then you share your sign-up link and go live. Shall I raise an onboarding request for you?',
    chips: ['Request onboarding', 'Raise an enquiry'],
    offer: 'onboarding',
  },
];

export const GREETING = `Hi! I can answer questions about Realx8 and what it can do for your property business. I can also start your ${TRIAL_DAYS}-day free trial, or raise an onboarding request or an enquiry for you.`;
export const GREETING_CHIPS = ['What can Realx8 do?', 'Realtor commissions', 'Can it carry my brand?', 'How much does it cost?', 'Start free trial', 'Request onboarding'];

export const OFF_TOPIC = 'I can only help with questions about Realx8 and its features. If your question is about Realx8 and I could not answer it, I can raise an enquiry and our team will reply.';
