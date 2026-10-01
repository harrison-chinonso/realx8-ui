/**
 * The Realx8 FAQ — platform content, the same for every company and every
 * visitor. Kept as data, not markup, so the Help page can search and group it,
 * and so changing a sentence is an edit here and nowhere else.
 *
 * Each answer is a list of blocks:
 *   'text'                      a paragraph
 *   { ul: [...] } / { ol: [...] } a bulleted / numbered list
 *   { table: { head, rows } }   a small table
 *   { contact: 'support' | 'fraud' }  the live contact options, drawn by the page
 *                               from the platform's — or the company's — settings
 */

export const FAQ_GROUPS = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        n: 1,
        q: 'What is Realx8?',
        a: [
          'Realx8 is a real-estate technology platform designed to help property developers, real-estate companies, agencies, Realtors, clients and investors manage their real-estate operations from one platform.',
          'Depending on your account and permissions, Realx8 can help you manage properties, clients, Realtors, leads, transactions, payments, commissions, referrals, investments, reports and other real-estate activities.',
        ],
      },
      {
        n: 2,
        q: 'Who can use Realx8?',
        a: [
          'Realx8 can be used by:',
          { ul: ['Real-estate developers', 'Real-estate companies', 'Property agencies', 'Realtors', 'Real-estate marketers', 'Property buyers', 'Clients', 'Investors', 'Managers', 'Accountants', 'Administrative staff', 'Other authorised users'] },
          'The features available to you depend on your account type and permissions.',
        ],
      },
      {
        n: 3,
        q: 'Do I need a company to use Realx8?',
        a: [
          'Not necessarily.',
          'Depending on how the Platform is configured, you may be able to register as an individual user, Realtor, Client, Investor or other authorised user.',
          'Some features are only available through a company or Tenant account.',
        ],
      },
    ],
  },
  {
    id: 'companies',
    title: 'Companies & accounts',
    items: [
      {
        n: 4,
        q: 'What is a Tenant on Realx8?',
        a: [
          'A Tenant is a separate company or organisation operating within Realx8.',
          'For example, Company A and Company B can both use Realx8 while maintaining separate business environments.',
          'Each company can have its own:',
          { ul: ['Realtors', 'Clients', 'Properties', 'Transactions', 'Commissions', 'Referrals', 'Reports', 'Administrators'] },
        ],
      },
      {
        n: 5,
        q: 'Can the same person belong to multiple companies?',
        a: [
          'Yes.',
          'Realx8 is designed to support multi-company relationships.',
          'For example, John can be:',
          { ul: ['a Realtor for Company A;', 'a Client for Company B; and', 'an Investor for Company C.'] },
          'Each relationship can have its own role, permissions, records and transaction history.',
        ],
      },
      {
        n: 6,
        q: 'Will my information from one company automatically appear under another company?',
        a: [
          'No.',
          'Realx8 is designed to keep Tenant information logically separated.',
          "Being a member of Company A does not automatically give you access to Company B's:",
          { ul: ['clients;', 'properties;', 'transactions;', 'commissions;', 'referrals;', 'reports; or', 'other restricted information.'] },
          'Access depends on your role and permissions within each company.',
        ],
      },
      {
        n: 7,
        q: 'Can I use different login details for different companies?',
        a: [
          'The Platform can support separate company relationships and account contexts.',
          'Depending on the authentication configuration implemented by Realx8, the same individual may use the same or different login credentials for different company relationships.',
          'The applicable authentication rules will be displayed during account creation or company onboarding.',
        ],
      },
      {
        n: 37,
        q: 'What happens to my data when I leave a company?',
        a: [
          "Your access to that company's Tenant environment may be removed or restricted.",
          'Certain transaction or financial records may remain available to the company where required for legitimate business, accounting, legal or regulatory purposes.',
          'Your relationship with another company on Realx8 may remain unaffected.',
        ],
      },
      {
        n: 38,
        q: 'What happens if I belong to multiple companies and leave one?',
        a: [
          'Leaving or being removed from one company does not automatically remove your relationship with other companies.',
          'Each Tenant relationship is managed separately.',
        ],
      },
      {
        n: 43,
        q: 'Can a company remove me from its Realx8 account?',
        a: [
          "Yes.",
          "An authorised company administrator may remove or restrict your access to that company's Tenant environment according to the company's policies and applicable agreements.",
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
        q: 'What roles are available on Realx8?',
        a: [
          'Available roles may include:',
          { ul: ['Super Administrator', 'Company Administrator', 'Manager', 'Realtor', 'Client', 'Investor', 'Accountant', 'Sales Officer', 'Marketing Officer', 'Support Officer'] },
          'Companies may have additional roles depending on their configuration.',
        ],
      },
      {
        n: 9,
        q: 'What can a Company Administrator do?',
        a: [
          'A Company Administrator may be able to:',
          { ul: ['manage company information;', 'add users;', 'assign roles;', 'manage Realtors;', 'manage clients;', 'create properties;', 'manage transactions;', 'configure commissions;', 'manage referrals;', 'approve transactions;', 'review reports;', 'manage company settings; and', 'perform other administrative activities.'] },
          "The exact permissions depend on the administrator's assigned access level.",
        ],
      },
      {
        n: 10,
        q: 'Can a Realtor manage clients on Realx8?',
        a: [
          'Yes.',
          'Where enabled, Realtors can:',
          { ul: ['add or manage clients;', 'track leads;', 'view assigned properties;', 'manage enquiries;', 'track transactions;', 'monitor commissions;', 'manage referrals; and', 'access other authorised features.'] },
        ],
      },
      {
        n: 29,
        q: 'Can companies see all my personal information?',
        a: [
          'Not necessarily.',
          'Access is controlled according to user roles and permissions.',
          "A company should only have access to information necessary for its authorised activities, subject to the Platform's configuration and applicable law.",
        ],
      },
      {
        n: 30,
        q: "Can one company see another company's information?",
        a: [
          'No, not by default.',
          "Realx8's multi-tenant architecture is designed to logically separate company environments.",
          'Unauthorised cross-company access is prohibited.',
        ],
      },
      {
        n: 39,
        q: 'Does Realx8 share my information with other Realtors?',
        a: [
          "Only where such access is authorised by the relevant company's configuration and your role.",
          "A Realtor should not automatically have access to another Realtor's private client, transaction or financial information.",
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
          'Companies can assign Realtors different grades.',
          'Example grades may include:',
          { ul: ['Basic', 'Premium', 'Professional', 'Ambassador', 'Partner'] },
          'Each grade may have a different commission rate.',
          'The actual grades, requirements and rates are determined by the relevant company.',
        ],
      },
      {
        n: 12,
        q: 'What commission rates does Realx8 use?',
        a: [
          'Realx8 can support configurable commission structures.',
          'An example configuration may be:',
          { table: { head: ['Grade', 'Commission'], rows: [['Basic', '10%'], ['Premium', '12%'], ['Professional', '15%'], ['Ambassador', '18%'], ['Partner', '20%']] } },
          'These percentages are examples of configurable rates and are not automatically applicable to every Realx8 company.',
          'Each company may establish its own commission structure.',
        ],
      },
      {
        n: 13,
        q: 'When does a Realtor receive commission?',
        a: [
          'A commission may initially appear as pending.',
          "Depending on the company's rules, commission may only become payable after:",
          { ol: ['the transaction is recorded;', 'the transaction is verified;', 'required payments are made;', 'the transaction is approved; and', 'other applicable conditions are satisfied.'] },
          'The specific commission rules are determined by the relevant company.',
        ],
      },
      {
        n: 14,
        q: 'What happens if my commission is disputed?',
        a: [
          'If a commission is disputed, the relevant company may review:',
          { ul: ['the transaction;', 'property;', 'Realtor;', 'referral;', 'payment history;', 'commission rate;', 'approval history; and', 'other relevant records.'] },
          'Realx8 may provide the technology and records necessary to support the review but does not automatically determine contractual disputes between a Realtor and a company.',
        ],
      },
      {
        n: 15,
        q: 'Does Realx8 support referrals?',
        a: [
          'Yes, where the referral feature is enabled.',
          'Companies may configure:',
          { ul: ['direct referrals;', 'multiple referral levels;', 'referral percentages;', 'eligibility requirements;', 'referral thresholds;', 'pending earnings;', 'approved earnings; and', 'payout rules.'] },
        ],
      },
      {
        n: 16,
        q: 'Who can make referrals?',
        a: [
          'The company can determine which users are eligible to participate in its referral programme.',
          'Unless otherwise configured, referral functionality may be limited to authorised Realtors.',
        ],
      },
      {
        n: 17,
        q: 'Can Realx8 support multiple referral levels?',
        a: [
          'Yes.',
          'Companies may configure more than one referral level where the feature is enabled.',
          'The company determines the applicable hierarchy and percentage for each level.',
        ],
      },
      {
        n: 18,
        q: 'What is a pending referral balance?',
        a: [
          'A pending referral balance represents referral earnings that have been recorded but are not yet available for payout.',
          'The amount may remain pending until the applicable transaction, payment, verification or approval conditions are satisfied.',
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
        a: ['An available balance is commission that has been approved and is eligible for payout, subject to the applicable payout rules. You can see it on your commission records.'],
      },
      {
        n: 20,
        q: 'How do I get my commission paid?',
        a: [
          'Where payouts are enabled, eligible Realtors request a payout directly from their commission records — choose the approved commissions you want paid and submit the request. The company reviews it and pays you.',
          'Payouts may be subject to:',
          { ul: ['minimum thresholds;', 'approval;', 'identity verification;', 'bank verification;', 'transaction completion;', 'fraud checks; and', 'other company requirements.'] },
        ],
      },
      {
        n: 21,
        q: 'Does Realx8 hold my money?',
        a: [
          'No.',
          'Realx8 does not hold funds for any user. Your commission records show what you have earned, what is pending and what is eligible for payout; the money itself is paid to you by the relevant company when a payout request is approved.',
          'Your commission records should not be treated as a bank deposit or regulated bank account.',
        ],
      },
      {
        n: 22,
        q: 'Can I pay for property through Realx8?',
        a: [
          'Where payment integration is enabled, Realx8 may allow users to make payments through supported payment providers.',
          'Payment processing may be handled by a third-party payment provider.',
        ],
      },
      {
        n: 23,
        q: 'Can I track installment payments?',
        a: [
          'Yes.',
          'Where enabled, Realx8 can record:',
          { ul: ['total property price;', 'amount paid;', 'outstanding balance;', 'payment dates;', 'installment schedules;', 'payment status;', 'invoices; and', 'receipts.'] },
          'The actual terms of an installment arrangement remain subject to the agreement between the buyer and the relevant company or property seller.',
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
        q: 'Does Realx8 verify every property listed on the Platform?',
        a: [
          'Not necessarily.',
          'Property information may be supplied by companies, developers, agencies or authorised users.',
          'Users should independently verify important property information, ownership, title documents, approvals and transaction terms before making a financial commitment.',
        ],
      },
      {
        n: 25,
        q: 'Is Realx8 the seller of the properties listed on the Platform?',
        a: [
          'Generally, no.',
          'Realx8 is a technology platform.',
          'The company, developer, agency or other authorised party responsible for a property remains responsible for the underlying property transaction unless otherwise expressly stated.',
        ],
      },
      {
        n: 26,
        q: 'Can I upload property documents?',
        a: [
          'Where the feature is enabled, authorised users may upload relevant documents.',
          'Users must have the legal right and appropriate authority to upload documents containing personal or confidential information.',
        ],
      },
      {
        n: 27,
        q: 'Can clients view their property transactions?',
        a: [
          'Yes, where the relevant company enables client access.',
          'Clients may be able to view:',
          { ul: ['purchased properties;', 'payment history;', 'outstanding balances;', 'transaction status;', 'invoices;', 'receipts;', 'documents; and', 'other information made available to them.'] },
        ],
      },
      {
        n: 28,
        q: 'Can I access my transaction history?',
        a: ['Where the feature is enabled, users can view relevant transaction history based on their role and permissions.'],
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & security',
    items: [
      {
        n: 31,
        q: 'How does Realx8 protect my information?',
        a: [
          'Realx8 uses reasonable technical and organisational security measures, which may include:',
          { ul: ['password protection;', 'encrypted connections;', 'role-based access;', 'tenant-level data segregation;', 'access controls;', 'audit logs;', 'backups;', 'monitoring; and', 'other security measures.'] },
          'However, no internet-connected system can guarantee absolute security.',
        ],
      },
      {
        n: 32,
        q: 'Does Realx8 sell my personal information?',
        a: [
          'No.',
          'Realx8 does not sell personal data as a commercial product.',
          'Information may be shared with authorised service providers where necessary to provide the Platform or comply with applicable law.',
        ],
      },
      {
        n: 33,
        q: 'Who can access my information?',
        a: [
          'Depending on the circumstances, information may be accessible to:',
          { ul: ['you;', 'authorised administrators;', 'authorised users within your company;', 'Realx8 personnel who require access;', 'approved service providers;', 'payment providers;', 'regulators or authorities where legally required; and', 'other parties where legally permitted and necessary.'] },
        ],
      },
      {
        n: 34,
        q: 'Can I request a copy of my personal information?',
        a: [
          'Subject to applicable law, you may request access to personal information held about you.',
          'You may be required to verify your identity before information is released.',
        ],
      },
      {
        n: 35,
        q: 'Can I request correction of my information?',
        a: [
          'Yes.',
          'Where applicable, you may request correction of inaccurate or incomplete personal information.',
          'Some information may need to be corrected by the company or organisation that originally supplied it.',
        ],
      },
      {
        n: 36,
        q: 'Can I request deletion of my information?',
        a: [
          'You may request deletion where applicable.',
          'However, certain information may need to be retained because of:',
          { ul: ['legal requirements;', 'tax obligations;', 'accounting requirements;', 'fraud prevention;', 'security;', 'dispute resolution;', 'contractual obligations; or', 'other lawful purposes.'] },
        ],
      },
      {
        n: 40,
        q: 'Can I change my password?',
        a: [
          'Yes.',
          'Users should change their passwords regularly and immediately change them if they suspect that their credentials have been compromised.',
        ],
      },
      {
        n: 41,
        q: 'What should I do if I suspect someone has accessed my account?',
        a: [
          'Immediately:',
          { ol: ['change your password;', 'secure your email account;', 'report the incident to Realx8 support; and', 'notify the relevant company administrator where appropriate.'] },
        ],
      },
      {
        n: 42,
        q: 'Can my Realx8 account be suspended?',
        a: [
          'Yes.',
          'An account may be suspended or restricted where there is suspected:',
          { ul: ['fraud;', 'unauthorised access;', 'abuse;', 'violation of the Terms;', 'security risk;', 'false information; or', 'unlawful activity.'] },
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
        q: 'Does Realx8 guarantee investment returns?',
        a: [
          'No.',
          'Realx8 may provide tools for recording and managing investment information, but it does not guarantee investment returns, appreciation, profitability or repayment unless expressly stated in a separate legally binding agreement.',
        ],
      },
      {
        n: 45,
        q: 'Does Realx8 provide legal or financial advice?',
        a: [
          'No.',
          'Information displayed on the Platform should not automatically be considered legal, tax, financial, investment or professional real-estate advice.',
          'Users should seek appropriate professional advice where necessary.',
        ],
      },
      {
        n: 46,
        q: 'Can I use Realx8 outside Nigeria?',
        a: [
          'Realx8 may be accessible from other countries.',
          'However, availability of particular services may vary by location, and users remain responsible for complying with applicable local laws.',
        ],
      },
      {
        n: 47,
        q: 'Does Realx8 use third-party services?',
        a: [
          'Yes.',
          'Realx8 may integrate with services such as:',
          { ul: ['payment providers;', 'cloud hosting providers;', 'email services;', 'SMS services;', 'analytics tools;', 'identity verification services;', 'mapping services; and', 'other technology providers.'] },
          'Their own terms and privacy policies may apply.',
        ],
      },
      {
        n: 48,
        q: 'Does Realx8 use AI?',
        a: [
          'Realx8 may introduce AI-powered features to improve workflows, analytics, customer support, recommendations or other Platform functionality.',
          'Where AI features process personal information, such processing will be subject to applicable privacy requirements and the Realx8 Privacy Policy.',
        ],
      },
      {
        n: 50,
        q: 'Where can I read the full Terms and Privacy Policy?',
        a: [
          'The complete Realx8 Terms and Conditions and Privacy Policy are available within the Platform and/or on the official Realx8 website.',
          'Users are encouraged to read both documents before using the Platform.',
        ],
      },
      {
        n: 53,
        q: 'Where can I find the latest version of the Terms and Privacy Policy?',
        a: [
          'The latest versions will be made available through the Realx8 Platform and/or official website.',
          'The effective date and last-updated date will be displayed on the respective documents.',
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
        q: 'How can I contact Realx8 support?',
        a: [
          'For technical, account or privacy support, contact:',
          { contact: 'support' },
        ],
      },
      {
        n: 51,
        q: 'Where can I report fraud or suspicious activity?',
        a: [
          'Report suspected fraud, fake property listings, unauthorised account activity, payment fraud, commission manipulation or other abuse through:',
          { contact: 'fraud' },
          'Please provide as much relevant information as possible, including transaction references or screenshots where appropriate.',
        ],
      },
      {
        n: 52,
        q: 'Can I suggest a new feature for Realx8?',
        a: [
          'Yes.',
          'We welcome feedback and suggestions that can improve the Platform.',
          'Feature requests can be submitted through the designated Realx8 support or feedback channels.',
          'Submission of an idea does not guarantee that the feature will be developed or implemented.',
        ],
      },
    ],
  },
];

/** Quick user guide: what each kind of user manages, in order. */
export const QUICK_GUIDE = [
  { who: 'Company / Administrator', steps: ['Properties', 'Clients', 'Realtors', 'Leads', 'Transactions', 'Payments', 'Commissions', 'Referrals', 'Reports'] },
  { who: 'Realtor', steps: ['Leads', 'Clients', 'Properties', 'Sales', 'Commissions', 'Referrals', 'Payouts'] },
  { who: 'Client', steps: ['Properties', 'Purchases', 'Payments', 'Balances', 'Documents', 'Transactions'] },
  { who: 'Investor', steps: ['Investments', 'Transactions', 'Payment Records', 'Investment Information', 'Reports'] },
];

export const TAGLINE = 'One Platform. Multiple Real-Estate Businesses. Connected Operations.';

/** Every question's text, flattened, for search. */
export const searchableText = (item) => [item.q, ...item.a.flatMap((block) => {
  if (typeof block === 'string') return [block];
  if (block.ul) return block.ul;
  if (block.ol) return block.ol;
  if (block.table) return [...block.table.head, ...block.table.rows.flat()];
  return [];
})].join(' ').toLowerCase();
