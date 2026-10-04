import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, Clock, Mail, MessageCircle, Phone, Search,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useCompanyCode from '../../hooks/useCompanyCode';
import { getSupportContacts } from '../../api/shareApi';
import { useAppearance } from '../../context/useAppearance';
import {
  FAQ_GROUPS, QUICK_GUIDE, searchableText, withCompanyName,
} from '../../content/helpFaq';

/**
 * Help & FAQ — one page for everyone: signed in or not, reached from the
 * sign-in and sign-up pages, a shared property, a referral link, or the app.
 *
 * The FAQ speaks as the company: its name fills every answer, and nothing
 * names the software behind it. The ways to reach a person —
 * email, WhatsApp, a phone call — are the platform's defaults with the
 * company's own over them (Settings → Help & support), for the company this
 * visitor is with: their own when signed in, else the one whose link brought
 * them here (`?c=<company code>`), whose look the page also takes on.
 */

/** wa.me wants the number in international form, digits only; a local 0… number is read as Nigerian. */
const whatsappHref = (number) => {
  let digits = String(number || '').replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}`;
  return digits ? `https://wa.me/${digits}` : null;
};

const telHref = (number) => {
  const cleaned = String(number || '').replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : null;
};

function ContactOptions({ contacts, compact = false, subject = 'Help request' }) {
  const options = [
    contacts.email && {
      key: 'email', icon: Mail, title: 'Email us', detail: contacts.email,
      href: `mailto:${contacts.email}?subject=${encodeURIComponent(subject)}`,
    },
    contacts.whatsapp && whatsappHref(contacts.whatsapp) && {
      key: 'whatsapp', icon: MessageCircle, title: 'Chat on WhatsApp', detail: contacts.whatsapp,
      href: whatsappHref(contacts.whatsapp), external: true,
    },
    contacts.phone && telHref(contacts.phone) && {
      key: 'phone', icon: Phone, title: 'Call us', detail: contacts.phone, href: telHref(contacts.phone),
    },
  ].filter(Boolean);

  if (!options.length) {
    return (
      <p className={`rounded-xl bg-slate-50 text-sm text-slate-600 ring-1 ring-slate-200 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        Contact details have not been set up yet. Please ask your company administrator.
      </p>
    );
  }

  return (
    <div className={`grid gap-3 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-3'}`}>
      {options.map(({ key, icon: Icon, title, detail, href, external }) => (
        <a
          key={key}
          href={href}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          className={`group flex items-center gap-3 rounded-xl bg-white ring-1 ring-slate-200 transition hover:ring-[color:var(--primary)] ${compact ? 'p-3' : 'p-4'}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            <span className="block truncate text-xs text-slate-600">{detail}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

function Answer({ blocks, contacts, brandName }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {blocks.map((block, i) => {
        if (typeof block === 'string') return <p key={i}>{block}</p>;
        if (block.ul) return <ul key={i} className="list-disc space-y-0.5 pl-5">{block.ul.map((li) => <li key={li}>{li}</li>)}</ul>;
        if (block.ol) return <ol key={i} className="list-decimal space-y-0.5 pl-5">{block.ol.map((li) => <li key={li}>{li}</li>)}</ol>;
        if (block.table) {
          return (
            <table key={i} className="w-full max-w-sm text-left text-sm">
              <thead><tr>{block.table.head.map((h) => <th key={h} className="border-b border-slate-200 py-1.5 pr-4 font-semibold text-slate-900">{h}</th>)}</tr></thead>
              <tbody>{block.table.rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell} className="border-b border-slate-100 py-1.5 pr-4">{cell}</td>)}</tr>)}</tbody>
            </table>
          );
        }
        if (block.contact) {
          return (
            <div key={i} className="pt-1">
              <ContactOptions
                contacts={contacts}
                compact
                subject={block.contact === 'fraud' ? 'Report: fraud or suspicious activity' : `Help with ${brandName || 'my account'}`}
              />
              {contacts.hours && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Clock size={13} aria-hidden="true" /> {contacts.hours}</p>}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function HelpPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signedIn = Boolean(useAuthStore((s) => s.accessToken));
  const sessionCompany = useAuthStore((s) => s.company);
  const { app_name, app_logo } = useAppearance();

  // The company this page is for. Signed in, the session's own (and its look
  // is already applied); otherwise the code the link carried.
  const linkCode = (params.get('c') || '').toUpperCase() || null;
  const { company: linkedCompany } = useCompanyCode(signedIn ? null : linkCode, { brand: true });
  const companyName = signedIn ? (sessionCompany?.name || null) : (linkedCompany?.name || null);
  // Whose name the page speaks in: the company's, else what the appearance
  // says (a company's own name since the server stopped lending the
  // platform's), never a hard-coded product name.
  const brandName = companyName || app_name || '';

  const [contacts, setContacts] = useState({});
  useEffect(() => {
    let cancelled = false;
    getSupportContacts(signedIn ? null : linkCode)
      .then((data) => { if (!cancelled) setContacts(data || {}); })
      .catch(() => { if (!cancelled) setContacts({}); });
    return () => { cancelled = true; };
  }, [signedIn, linkCode]);

  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [open, setOpen] = useState(() => new Set());
  const toggle = (n) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  const needle = query.trim().toLowerCase();
  const faq = useMemo(() => withCompanyName(FAQ_GROUPS, brandName), [brandName]);
  const groups = useMemo(() => faq
    .filter((g) => topic === 'all' || g.id === topic)
    .map((g) => ({ ...g, items: needle ? g.items.filter((item) => searchableText(item).includes(needle)) : g.items }))
    .filter((g) => g.items.length), [faq, topic, needle]);
  const matches = groups.reduce((t, g) => t + g.items.length, 0);

  // Back to wherever they came from; a fresh tab has nowhere to go back to.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(signedIn ? '/' : (linkCode ? `/login/${linkCode}` : '/login'));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={goBack} className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          <div className="flex min-w-0 items-center gap-2">
            {(linkedCompany?.logo || app_logo) && (
              <img src={linkedCompany?.logo || app_logo} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
            )}
            <span className="truncate text-sm font-semibold text-slate-900">{brandName}</span>
          </div>
          {signedIn
            ? <Link to="/" className="rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:underline">Dashboard</Link>
            : <Link to={linkCode ? `/login/${linkCode}` : '/login'} className="rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:underline">Sign in</Link>}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <section className="space-y-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">How can we help?</h1>
          <p className="text-sm text-slate-600">Search the questions people ask most, or get in touch with {brandName || 'the team'}.</p>
          <label className="relative mx-auto block max-w-xl">
            <span className="sr-only">Search help</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search, e.g. commission, payout, password"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm focus:border-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(var(--primary-rgb),0.25)]"
            />
          </label>
        </section>

        <section aria-labelledby="contact-heading" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="contact-heading" className="text-lg font-semibold text-slate-900">Talk to us</h2>
            {contacts.hours && <p className="flex items-center gap-1.5 text-xs text-slate-500"><Clock size={13} aria-hidden="true" /> {contacts.hours}</p>}
          </div>
          <ContactOptions contacts={contacts} />
        </section>

        <section aria-labelledby="faq-heading" className="space-y-4">
          <h2 id="faq-heading" className="text-lg font-semibold text-slate-900">Frequently asked questions</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
            {[{ id: 'all', title: 'All topics' }, ...FAQ_GROUPS].map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={topic === g.id}
                onClick={() => setTopic(g.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${topic === g.id ? 'bg-primary text-[color:var(--primary-ink,#fff)]' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300'}`}
              >
                {g.title}
              </button>
            ))}
          </div>

          {needle && (
            <p className="text-xs text-slate-500" aria-live="polite">
              {matches ? `${matches} question${matches === 1 ? '' : 's'} match “${query.trim()}”.` : ''}
            </p>
          )}

          {groups.length ? groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{g.title}</h3>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                {g.items.map((item) => {
                  const isOpen = open.has(item.n) || Boolean(needle);
                  return (
                    <li key={item.n}>
                      <button
                        type="button"
                        onClick={() => toggle(item.n)}
                        aria-expanded={isOpen}
                        aria-controls={`faq-${item.n}`}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50"
                      >
                        <span className="text-sm font-semibold text-slate-900">{item.q}</span>
                        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      {isOpen && (
                        <div id={`faq-${item.n}`} className="px-4 pb-4">
                          <Answer blocks={item.a} contacts={contacts} brandName={brandName} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )) : (
            <div className="rounded-xl bg-white p-6 text-center ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-900">No questions match “{query.trim()}”.</p>
              <p className="mt-1 text-sm text-slate-600">Try another word, or get in touch above — we are happy to help.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="guide-heading" className="space-y-3">
          <h2 id="guide-heading" className="text-lg font-semibold text-slate-900">Quick user guide</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_GUIDE.map((g) => (
              <div key={g.who} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">If you are a {g.who}</p>
                <p className="mt-1 text-sm text-slate-600">You can manage:</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium text-slate-800">
                  {g.steps.map((step, i) => (
                    <span key={step} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-slate-400" aria-hidden="true">→</span>}
                      {step}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="space-y-1 border-t border-slate-200 pt-6 text-center">
          {brandName && <p className="text-sm font-semibold text-slate-800">{brandName}</p>}
          <p className="text-xs text-slate-400">
            <Link to="/legal/terms" className="hover:underline">Terms of Use</Link> ·{' '}
            <Link to="/legal/terms#part-b" className="hover:underline">Privacy Policy</Link>
          </p>
          {brandName && <p className="text-xs text-slate-400">© {new Date().getFullYear()} {brandName}. All rights reserved.</p>}
        </footer>
      </main>
    </div>
  );
}
