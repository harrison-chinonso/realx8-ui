/**
 * The FAQ, written as the company's own: the person reading it is a client,
 * realtor or member of staff of ONE company, on that company's platform, and
 * every answer speaks in its name. `{company}` is replaced with the company's
 * name when the page renders (withCompanyName), so no answer names the
 * software behind it. Kept as data, not markup, so the Help page can search
 * and group it, and so changing a sentence is an edit here and nowhere else.
 *
 * Each answer is a list of blocks:
 *   'text'                      a paragraph
 *   { ul: [...] } / { ol: [...] } a bulleted / numbered list
 *   { table: { head, rows } }   a small table
 *   { contact: 'support' | 'fraud' }  the live contact options, drawn by the page
 *                               from the company's settings (Settings → Help & support)
 */

export const FAQ_GROUPS = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        n: 1,
        q: 'What can I do on {company}?',
        a: [
          '{company} is where you manage your relationship with us in one place.',
          'Depending on your account and permissions, you can manage properties, clients, Realtors, leads, transactions, payments, commissions, referrals, investments, reports and other real-estate activities.',
        ],
      },
      {
        n: 2,
        q: 'Who uses {company}?',
        a: [
          '{company} is used by:',
          { ul: ['our clients and property buyers;', 'our Realtors and marketers;', 'investors;', 'our managers, accountants and administrative staff; and', 'other people we have authorised.'] },
          'The features available to you depend on your account type and permissions.',
        ],
      },
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    items: [
      {
        n: 37,
        q: 'What happens to my data if I leave {company}?',
        a: [
          'Your access may be removed or restricted.',
          'Certain transaction or financial records may be kept where required for legitimate business, accounting, legal or regulatory purposes.',
        ],
      },
      {
        n: 43,
        q: 'Can {company} remove or restrict my account?',
        a: [
          'Yes.',
          'An authorised administrator may remove or restrict your access in line with our policies and any agreement you have with us.',
        ],
      },
      {
        n: 42,
        q: 'Can my account be suspended?',
        a: [
          'Yes.',
          'An account may be suspended or restricted where there is suspected:',
          { ul: ['fraud;', 'unauthorised access;', 'abuse;', 'violation of the Terms;', 'security risk;', 'false information; or', 'unlawful activity.'] },
        ],
      },
      {
        n: 40,
        q: 'Can I change my password?',
        a: [
          'Yes.',
          'Change your password regularly, and immediately if you suspect it has been compromised.',
        ],
      },
    ],
  },
  {
    id: 'roles',
    title: 'Roles & access',
    items: [
      {
        n: 8,
        q: 'What roles are there?',
        a: [
          'Roles may include:',
          { ul: ['Administrator', 'Manager', 'Realtor', 'Client', 'Investor', 'Accountant', 'Sales Officer', 'Marketing Officer', 'Support Officer'] },
          'We may add other roles as our team needs them.',
        ],
      },
      {
        n: 9,
        q: 'What can an administrator do?',
        a: [
          'An administrator may be able to:',
          { ul: ['manage our company information;', 'add users;', 'assign roles;', 'manage Realtors;', 'manage clients;', 'create properties;', 'manage transactions;', 'configure commissions;', 'manage referrals;', 'approve transactions;', 'review reports;', 'manage settings; and', 'perform other administrative activities.'] },
          "The exact permissions depend on the administrator's assigned access level.",
        ],
      },
      {
        n: 10,
        q: 'Can a Realtor manage clients?',
        a: [
          'Yes.',
          'Where enabled, Realtors can:',
          { ul: ['add or manage clients;', 'track leads;', 'view assigned properties;', 'manage enquiries;', 'track transactions;', 'monitor commissions;', 'manage referrals; and', 'access other authorised features.'] },
        ],
      },
      {
        n: 29,
        q: 'Can everyone at {company} see all my personal information?',
        a: [
          'No.',
          'Access is controlled by role and permissions. Our staff only see the information they need for their work, subject to applicable law.',
        ],
      },
      {
        n: 39,
        q: 'Can other Realtors see my clients or earnings?',
        a: [
          'No, not unless their role has been given that access.',
          "A Realtor does not automatically see another Realtor's private client, transaction or financial information.",
        ],
      },
    ],
  },
  {
    id: 'commissions',
    title: 'Commissions & referrals',
    items: [
      {
        n: 11,
        q: 'How does the Realtor grading system work?',
        a: [
          'Realtors may be assigned different grades.',
          'Example grades may include:',
          { ul: ['Basic', 'Premium', 'Professional', 'Ambassador', 'Partner'] },
          'Each grade may have a different commission rate. Your grade, its requirements and its rate are shown in your account.',
        ],
      },
      {
        n: 12,
        q: 'What commission rates does {company} use?',
        a: [
          'Our rates depend on your grade. An example might be:',
          { table: { head: ['Grade', 'Commission'], rows: [['Basic', '10%'], ['Premium', '12%'], ['Professional', '15%'], ['Ambassador', '18%'], ['Partner', '20%']] } },
          'These figures are only an example. Your actual rate is shown on your commission records.',
        ],
      },
      {
        n: 13,
        q: 'When does a Realtor receive commission?',
        a: [
          'A commission may first appear as pending.',
          'It usually becomes payable after:',
          { ol: ['the transaction is recorded;', 'the transaction is verified;', 'required payments are made;', 'the transaction is approved; and', 'any other conditions we have set are met.'] },
        ],
      },
      {
        n: 14,
        q: 'What happens if my commission is disputed?',
        a: [
          'We review disputed commissions, which may include:',
          { ul: ['the transaction;', 'the property;', 'the Realtor;', 'the referral;', 'payment history;', 'the commission rate;', 'approval history; and', 'other relevant records.'] },
          'Contact us with the details and we will look into it.',
        ],
      },
      {
        n: 15,
        q: 'Do you offer referrals?',
        a: [
          'Yes, where the referral programme is enabled.',
          'Our referral programme may include:',
          { ul: ['direct referrals;', 'multiple referral levels;', 'referral percentages;', 'eligibility requirements;', 'referral thresholds;', 'pending earnings;', 'approved earnings; and', 'payout rules.'] },
        ],
      },
      {
        n: 16,
        q: 'Who can make referrals?',
        a: [
          'We decide who is eligible for our referral programme.',
          'Unless we say otherwise, referrals are open to authorised Realtors.',
        ],
      },
      {
        n: 17,
        q: 'Are there multiple referral levels?',
        a: [
          'There can be, where enabled.',
          'The levels and the percentage for each are shown in your referral details.',
        ],
      },
      {
        n: 18,
        q: 'What is a pending referral balance?',
        a: [
          'A pending referral balance is referral earnings that have been recorded but are not yet available for payout.',
          'It stays pending until the transaction, payment, verification or approval conditions are met.',
        ],
      },
    ],
  },
  {
    id: 'payouts',
    title: 'Payouts & payments',
    items: [
      {
        n: 19,
        q: 'What is an available commission balance?',
        a: ['An available balance is commission that has been approved and is eligible for payout, subject to our payout rules. You can see it on your commission records.'],
      },
      {
        n: 20,
        q: 'How do I get my commission paid?',
        a: [
          'Where payouts are enabled, request a payout directly from your commission records: choose the approved commissions you want paid and submit the request. We review it and pay you.',
          'Payouts may be subject to:',
          { ul: ['minimum thresholds;', 'approval;', 'identity verification;', 'bank verification;', 'transaction completion;', 'fraud checks; and', 'other requirements.'] },
        ],
      },
      {
        n: 21,
        q: 'Does {company} hold my money in a wallet?',
        a: [
          'No.',
          'There is no wallet. Your commission records show what you have earned, what is pending and what is eligible for payout; we pay you directly when a payout request is approved.',
          'Your commission records are not a bank deposit or a bank account.',
        ],
      },
      {
        n: 22,
        q: 'Can I pay for a property here?',
        a: [
          'Where online payment is enabled, you can pay through our supported payment providers.',
          'Payments are processed by a third-party payment provider.',
        ],
      },
      {
        n: 23,
        q: 'Can I track installment payments?',
        a: [
          'Yes.',
          'Where enabled, you can see:',
          { ul: ['the total property price;', 'the amount paid;', 'the outstanding balance;', 'payment dates;', 'installment schedules;', 'payment status;', 'invoices; and', 'receipts.'] },
          'The terms of an installment arrangement are those in your agreement with us.',
        ],
      },
    ],
  },
  {
    id: 'properties',
    title: 'Properties & transactions',
    items: [
      {
        n: 24,
        q: 'Should I verify property information myself?',
        a: [
          'Yes, for anything important.',
          'Before making a financial commitment, independently verify important property information, ownership, title documents, approvals and transaction terms.',
        ],
      },
      {
        n: 26,
        q: 'Can I upload property documents?',
        a: [
          'Where the feature is enabled, authorised users may upload relevant documents.',
          'Only upload documents you have the right and authority to share, especially ones containing personal or confidential information.',
        ],
      },
      {
        n: 27,
        q: 'Can clients view their property transactions?',
        a: [
          'Yes, where client access is enabled.',
          'Clients may be able to view:',
          { ul: ['purchased properties;', 'payment history;', 'outstanding balances;', 'transaction status;', 'invoices;', 'receipts;', 'documents; and', 'other information we make available.'] },
        ],
      },
      {
        n: 28,
        q: 'Can I access my transaction history?',
        a: ['Yes. Where enabled, you can view the transaction history that relates to your role and permissions.'],
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & security',
    items: [
      {
        n: 31,
        q: 'How is my information protected?',
        a: [
          'We use reasonable technical and organisational security measures, which may include:',
          { ul: ['password protection;', 'encrypted connections;', 'role-based access;', 'access controls;', 'audit logs;', 'backups;', 'monitoring; and', 'other security measures.'] },
          'However, no internet-connected system can guarantee absolute security.',
        ],
      },
      {
        n: 32,
        q: 'Does {company} sell my personal information?',
        a: [
          'No.',
          'We do not sell personal data.',
          'Information may be shared with authorised service providers where necessary to provide this service or to comply with applicable law.',
        ],
      },
      {
        n: 33,
        q: 'Who can access my information?',
        a: [
          'Depending on the circumstances, information may be accessible to:',
          { ul: ['you;', 'our authorised administrators and staff;', 'technical support personnel who need access to keep the service running;', 'approved service providers;', 'payment providers;', 'regulators or authorities where legally required; and', 'other parties where legally permitted and necessary.'] },
        ],
      },
      {
        n: 34,
        q: 'Can I request a copy of my personal information?',
        a: [
          'Subject to applicable law, you may request access to the personal information we hold about you.',
          'We may need to verify your identity before releasing it.',
        ],
      },
      {
        n: 35,
        q: 'Can I request correction of my information?',
        a: [
          'Yes.',
          'You may request correction of inaccurate or incomplete personal information.',
        ],
      },
      {
        n: 36,
        q: 'Can I request deletion of my information?',
        a: [
          'You may request deletion where applicable.',
          'However, certain information may need to be kept because of:',
          { ul: ['legal requirements;', 'tax obligations;', 'accounting requirements;', 'fraud prevention;', 'security;', 'dispute resolution;', 'contractual obligations; or', 'other lawful purposes.'] },
        ],
      },
      {
        n: 41,
        q: 'What should I do if I suspect someone has accessed my account?',
        a: [
          'Immediately:',
          { ol: ['change your password;', 'secure your email account; and', 'report it to us using the contact details below.'] },
        ],
      },
    ],
  },
  {
    id: 'legal',
    title: 'Investments, advice & policies',
    items: [
      {
        n: 44,
        q: 'Does {company} guarantee investment returns?',
        a: [
          'No.',
          'Investment information shown here is a record, not a guarantee of returns, appreciation, profitability or repayment, unless expressly stated in a separate legally binding agreement.',
        ],
      },
      {
        n: 45,
        q: 'Is the information here legal or financial advice?',
        a: [
          'No.',
          'Nothing shown here is legal, tax, financial, investment or professional real-estate advice.',
          'Seek appropriate professional advice where necessary.',
        ],
      },
      {
        n: 46,
        q: 'Can I use {company} outside Nigeria?',
        a: [
          'Yes, you can sign in from other countries.',
          'Some services may vary by location, and you remain responsible for complying with local laws.',
        ],
      },
      {
        n: 47,
        q: 'Are third-party services used?',
        a: [
          'Yes.',
          'We work with services such as:',
          { ul: ['payment providers;', 'cloud hosting providers;', 'email services;', 'SMS services;', 'analytics tools;', 'identity verification services;', 'mapping services; and', 'other technology providers.'] },
          'Their own terms and privacy policies may apply.',
        ],
      },
      {
        n: 48,
        q: 'Is AI used?',
        a: [
          'Some features may use AI to improve workflows, analytics, customer support or recommendations.',
          'Where AI features process personal information, that processing follows applicable privacy requirements and the Privacy Policy.',
        ],
      },
      {
        n: 50,
        q: 'Where can I read the Terms of Use and Privacy Policy?',
        a: [
          'Both are available from the Terms & Privacy link at the bottom of this page and on the sign-in and sign-up pages.',
          'The effective date and last-updated date are shown at the top of the document.',
        ],
      },
    ],
  },
  {
    id: 'contact',
    title: 'Support & feedback',
    items: [
      {
        n: 49,
        q: 'How can I contact {company}?',
        a: [
          'For account, technical or privacy questions, contact us:',
          { contact: 'support' },
        ],
      },
      {
        n: 51,
        q: 'Where can I report fraud or suspicious activity?',
        a: [
          'Report suspected fraud, fake property listings, unauthorised account activity, payment fraud, commission manipulation or other abuse to us:',
          { contact: 'fraud' },
          'Include as much detail as you can, such as transaction references or screenshots.',
        ],
      },
      {
        n: 52,
        q: 'Can I suggest an improvement?',
        a: [
          'Yes, we welcome feedback and suggestions.',
          'Send them to us using the contact details above.',
          'Submitting an idea does not guarantee that it will be built.',
        ],
      },
    ],
  },
];

/** Quick user guide: what each kind of user manages, in order. */
export const QUICK_GUIDE = [
  { who: 'Administrator', steps: ['Properties', 'Clients', 'Realtors', 'Leads', 'Transactions', 'Payments', 'Commissions', 'Referrals', 'Reports'] },
  { who: 'Realtor', steps: ['Leads', 'Clients', 'Properties', 'Sales', 'Commissions', 'Referrals', 'Payouts'] },
  { who: 'Client', steps: ['Properties', 'Purchases', 'Payments', 'Balances', 'Documents', 'Transactions'] },
  { who: 'Investor', steps: ['Investments', 'Transactions', 'Payment Records', 'Investment Information', 'Reports'] },
];

/** `{company}` → the company's name, in every question and answer. */
const fill = (text, name) => (typeof text === 'string'
  ? text.replace(/\{company\}/g, (_, offset) => (offset === 0 ? name.charAt(0).toUpperCase() + name.slice(1) : name))
  : text);

export const withCompanyName = (groups, name) => {
  // Only before any name is known (a visitor with no company and no platform
  // name set) — never a product name.
  const who = String(name || '').trim() || 'our platform';
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      q: fill(item.q, who),
      a: item.a.map((block) => {
        if (typeof block === 'string') return fill(block, who);
        if (block.ul) return { ul: block.ul.map((t) => fill(t, who)) };
        if (block.ol) return { ol: block.ol.map((t) => fill(t, who)) };
        return block;
      }),
    })),
  }));
};

/** Every question's text, flattened, for search. */
export const searchableText = (item) => [item.q, ...item.a.flatMap((block) => {
  if (typeof block === 'string') return [block];
  if (block.ul) return block.ul;
  if (block.ol) return block.ol;
  if (block.table) return [...block.table.head, ...block.table.rows.flat()];
  return [];
})].join(' ').toLowerCase();
