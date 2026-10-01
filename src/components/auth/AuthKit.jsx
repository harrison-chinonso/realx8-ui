import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Check, Eye, EyeOff, HelpCircle, Home, ScrollText,
} from 'lucide-react';
import PropertyCarousel from '../common/PropertyCarousel';
import { useAppearance, useCurrency } from '../../context/useAppearance';
import { parseImages } from '../../utils/parseImages';
import { resolveMedia } from '../../utils/mediaUrl';
import { MIN_PASSWORD_LENGTH } from '../../constants/password';

/**
 * The pieces the sign-in and sign-up pages are built from, in one place so the
 * two cannot drift: the dark field, the password field with its Caps Lock
 * warning, the strength meter, the company header, the showcase panel and the
 * page shell.
 *
 * Buttons on the brand colour use `--primary-ink` (set with the theme) for
 * their text, so a tenant with a pale colour gets dark text rather than white
 * on cream.
 */

export const primaryButton = 'flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50';
export const primaryInk = { color: 'var(--primary-ink, #fff)' };
export const ghostButton = 'flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2B3350] px-4 text-sm font-semibold text-[#F3F1EC] transition hover:bg-white/5 disabled:opacity-50';
const inputClass = 'h-11 w-full rounded-xl border border-[#2B3350] bg-[#161B2C] px-3.5 text-sm text-[#F3F1EC] placeholder:text-[#7C8497] transition focus:border-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(var(--primary-rgb),0.35)] read-only:cursor-not-allowed read-only:text-[#A6ADBD]';

export function AuthField({
  id, label, hint, note, className = '', inputClassName = '', ...input
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-xs font-semibold text-[#D5D9E2]">
        {label}{note && <span className="font-normal text-[#A6ADBD]"> {note}</span>}
      </label>
      <input id={id} className={`${inputClass} ${inputClassName}`} {...input} />
      {hint}
    </div>
  );
}

/**
 * A password input that can be shown, and says when Caps Lock is on — the
 * commonest reason a remembered password is "wrong".
 */
export function PasswordField({
  id, label, action, hint, invalid = false, ...input
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const readCaps = (event) => {
    if (typeof event.getModifierState === 'function') setCapsLock(event.getModifierState('CapsLock'));
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-semibold text-[#D5D9E2]">{label}</label>
        {action}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => setCapsLock(false)}
          aria-invalid={invalid || undefined}
          className={`${inputClass} pr-12 ${invalid ? 'border-rose-400' : ''}`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-[#A6ADBD] hover:text-white"
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {capsLock && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-300" role="status">
          <AlertTriangle size={14} aria-hidden="true" /> Caps Lock is on
        </p>
      )}
      {hint}
    </div>
  );
}

/**
 * Six boxes for a 6-digit code. One real input lies over them — so paste,
 * the phone's one-time-code suggestion and screen readers all work as on any
 * field — and the boxes only draw what it holds: a dot per digit, and a ring
 * on the next one while it has focus.
 */
export function PasscodeInput({
  id, label, value, onChange, autoFocus = false, disabled = false,
}) {
  const [focused, setFocused] = useState(false);
  const digits = String(value || '').slice(0, 6);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-semibold text-[#D5D9E2]">{label}</label>
      <div className="relative">
        <div className="grid grid-cols-6 gap-2" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => {
            const filled = i < digits.length;
            const next = focused && i === Math.min(digits.length, 5);
            return (
              <span
                key={i}
                className={`flex h-12 items-center justify-center rounded-xl border bg-[#161B2C] transition ${next ? 'border-[color:var(--primary)] ring-2 ring-[rgba(var(--primary-rgb),0.35)]' : 'border-[#2B3350]'}`}
              >
                {filled && <span className="h-3 w-3 rounded-full bg-[#F3F1EC]" />}
              </span>
            );
          })}
        </div>
        <input
          id={id}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={digits}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>
    </div>
  );
}

const STRENGTH = [
  { label: `Use ${MIN_PASSWORD_LENGTH} or more characters with a mix of letters, numbers and symbols.`, text: 'text-[#A6ADBD]', bar: 'bg-[#262D44]' },
  { label: 'Weak', text: 'text-rose-300', bar: 'bg-rose-500' },
  { label: 'Fair', text: 'text-amber-300', bar: 'bg-amber-500' },
  { label: 'Good', text: 'text-sky-300', bar: 'bg-sky-500' },
  { label: 'Strong', text: 'text-emerald-300', bar: 'bg-emerald-500' },
];

/** The checks behind the meter. Only the length is required by the server; the rest is advice. */
export const passwordChecks = (password = '') => [
  { text: `At least ${MIN_PASSWORD_LENGTH} characters`, ok: password.length >= MIN_PASSWORD_LENGTH },
  { text: 'Upper and lower case', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
  { text: 'A number', ok: /\d/.test(password) },
  { text: 'A symbol', ok: /[^A-Za-z0-9]/.test(password) },
];

export function PasswordStrength({ password }) {
  const checks = passwordChecks(password);
  const score = password ? checks.filter((c) => c.ok).length : 0;
  const level = STRENGTH[score];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 rounded-full ${i < score ? level.bar : 'bg-[#262D44]'}`} />
        ))}
      </div>
      <p className={`text-xs ${level.text}`} aria-live="polite">{password ? `Password strength: ${level.label}` : level.label}</p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((check) => (
          <li key={check.text} className={`flex items-center gap-1.5 text-xs ${check.ok ? 'text-emerald-300' : 'text-[#7C8497]'}`}>
            <Check size={12} strokeWidth={3} aria-hidden="true" />
            {check.text}
            <span className="sr-only">{check.ok ? '(done)' : '(not yet)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Whose sign-in page this is: the company's logo and name when the page knows
 * the company, the platform's otherwise, with "Powered by" underneath so the
 * visitor knows the product they are signing in to.
 */
export function AuthBrand({ company }) {
  const { app_name, app_logo, nameLoaded } = useAppearance();
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = company?.logo || app_logo;
  const name = company?.name || app_name || 'RealX8';
  if (!nameLoaded && !company) {
    return <span className="inline-block h-11 w-40 animate-pulse rounded-xl bg-white/10" aria-hidden="true" />;
  }
  return (
    <div className="flex min-w-0 items-center gap-3">
      {logo && !logoFailed ? (
        <img
          src={logo}
          alt=""
          onError={() => setLogoFailed(true)}
          className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-bold" style={primaryInk} aria-hidden="true">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-[#F3F1EC]">{name}</p>
        {company && app_name && app_name !== company.name && (
          <p className="truncate text-xs text-[#A6ADBD]">Powered by {app_name}</p>
        )}
      </div>
    </div>
  );
}

/** The cover of a showcased property: its first photograph, else a video's poster. */
const coverOf = (images) => {
  for (const item of parseImages(images)) {
    const url = typeof item === 'string' ? item : item?.url;
    if (!url) continue;
    const media = resolveMedia(url, typeof item === 'string' ? undefined : item?.type);
    if (media?.kind === 'image') return media.src;
  }
  return null;
};

/**
 * The company's own listings beside the form — the property, where it is,
 * what it starts at, and the offer on it — instead of stock photographs.
 * Falls back to the platform carousel when the company has shared nothing yet.
 */
export function ShowcasePanel({ properties = [], compact = false }) {
  const fmt = useCurrency();
  const slides = properties.map((p) => ({ ...p, cover: coverOf(p.images) })).filter((p) => p.cover);
  const [active, setActive] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    timer.current = setInterval(() => setActive((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(timer.current);
  }, [slides.length]);

  if (!slides.length) return <PropertyCarousel className="h-full" compact={compact} />;
  const slide = slides[Math.min(active, slides.length - 1)];
  const place = [slide.city, slide.state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  const facts = [
    slide.from_price ? `From ${fmt(slide.from_price)}` : null,
    slide.max_months ? `pay over up to ${slide.max_months} months` : null,
    slide.units_available ? `${slide.units_available.toLocaleString()} ${slide.units_available === 1 ? 'unit' : 'units'} left` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1C2438]">
      {slides.map((s, i) => (
        <img
          key={s.id}
          src={s.cover}
          alt=""
          loading={i === 0 ? 'eager' : 'lazy'}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          style={{ opacity: i === active ? 1 : 0 }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden="true" />
      <div className={`absolute inset-x-0 bottom-0 flex flex-col gap-3 ${compact ? 'p-5' : 'p-8'}`}>
        {slide.promotion && !compact && (
          <span className="self-start rounded-full bg-pink-700 px-3 py-1 text-xs font-bold text-white">
            {[slide.promotion.name, slide.promotion.benefit_label].filter(Boolean).join(' · ')}
          </span>
        )}
        <div className={`rounded-[22px] bg-[rgba(14,18,32,0.82)] ${compact ? 'p-4' : 'p-6'} text-white`}>
          {compact && slide.promotion && (
            <span className="mb-1.5 inline-block rounded-full bg-pink-700 px-2.5 py-0.5 text-xs font-bold text-white">
              {[slide.promotion.name, slide.promotion.benefit_label].filter(Boolean).join(' · ')}
            </span>
          )}
          {place && !compact && <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A6ADBD]">Now selling · {place}</p>}
          <p className={`mt-1 font-bold tracking-tight ${compact ? 'text-xl' : 'text-2xl'}`}>{slide.name}{compact && place ? <span className="text-sm font-semibold text-[#D5D9E2]"> · {place}</span> : null}</p>
          {facts && <p className="mt-1 text-sm text-[#D5D9E2]">{facts}</p>}
        </div>
        {slides.length > 1 && !compact && (
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show ${s.name}`}
                aria-current={i === active}
                className="flex h-6 items-center"
              >
                <span className={`block h-1.5 rounded-full transition-all ${i === active ? 'w-7 bg-white' : 'w-3 bg-white/40'}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** A placeholder panel for pages whose side has nothing to show but words. */
export function AsidePanel({ kicker, title, children }) {
  return (
    <div className="flex h-full flex-col justify-end gap-5 rounded-[28px] bg-[#1C2438] p-12 text-[#F3F1EC]">
      <Home size={28} className="text-[#56607A]" aria-hidden="true" />
      {kicker && <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A6ADBD]">{kicker}</p>}
      {title && <p className="max-w-lg text-2xl font-bold leading-tight tracking-tight">{title}</p>}
      {children}
    </div>
  );
}

/**
 * A link drawn as an icon, its label shown on hover and on keyboard focus —
 * the label is also its accessible name, so a screen reader hears the words
 * the tooltip shows. Clicking is an ordinary link.
 */
export function IconLink({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-[#A6ADBD] transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--primary-rgb),0.6)]"
    >
      <Icon size={20} aria-hidden="true" />
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 whitespace-nowrap rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </Link>
  );
}

/** Help and Terms & Privacy, side by side, for the right of the sign-in and sign-up header. */
export function AuthHeaderLinks({ helpTo = '/help' }) {
  return (
    <nav aria-label="Help and policies" className="flex items-center gap-1">
      <IconLink to={helpTo} icon={HelpCircle} label="Get help" />
      <IconLink to="/legal/terms" icon={ScrollText} label="Terms & Privacy" />
    </nav>
  );
}

/**
 * The page: form on the left, the company's world on the right. On a phone the
 * form comes first and full width, with an optional photo strip above it.
 */
export function AuthShell({
  brand, headerAction, aside, mobileTop, footer, children, wide = false,
}) {
  return (
    <div className="flex min-h-screen w-full bg-[#0E1220] font-body text-[#F3F1EC] lg:h-screen lg:overflow-hidden">
      <main className={`flex w-full shrink-0 flex-col lg:overflow-y-auto ${wide ? 'lg:w-[560px]' : 'lg:w-[480px]'}`}>
        {mobileTop && <div className="lg:hidden">{mobileTop}</div>}
        <div className={`relative flex flex-1 flex-col gap-7 bg-[#0E1220] px-5 pb-8 pt-6 sm:px-10 lg:px-14 lg:pt-10 ${mobileTop ? '-mt-4 rounded-t-[20px] lg:mt-0 lg:rounded-none' : ''}`}>
          {/* The name on the left, an action (Get help) opposite it. With a
              photo strip on a phone the name is on the strip, so the action
              keeps the row to itself, still on the right. */}
          <div className="flex items-center justify-between gap-3">
            <div className={`min-w-0 ${mobileTop ? 'hidden lg:block' : ''}`}>{brand}</div>
            {headerAction && <div className="ml-auto shrink-0">{headerAction}</div>}
          </div>
          <div className="flex flex-1 flex-col justify-center gap-7">{children}</div>
          {footer && <div className="flex flex-col gap-3 text-sm text-[#A6ADBD]">{footer}</div>}
        </div>
      </main>
      <aside className="hidden flex-1 p-4 pl-0 lg:flex">
        <div className="relative flex-1 overflow-hidden rounded-[28px]">{aside}</div>
      </aside>
    </div>
  );
}
