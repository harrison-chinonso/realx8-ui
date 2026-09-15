import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';

/**
 * One reply, with whatever the assistant attached to it.
 *
 * A locally-answered message is not a paragraph. It is usually prose plus a
 * numbered walkthrough, or prose plus a link, or a question with a count of
 * what is still needed. Cramming that into a single string produces a wall of
 * text that nobody reads to the end, so each part is rendered as what it is and
 * the parts that are absent take up no room.
 */

/**
 * The only markup the recipes use, rendered rather than shown.
 *
 * Steps read "Open **Finance → Invoicing**" because the bold is where the eye
 * needs to land. Printing the asterisks would be worse than never having
 * written them, and pulling in a markdown library to bold three words is not a
 * trade worth making.
 */
const emphasise = (text) => String(text ?? '').split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
  part.startsWith('**') && part.endsWith('**')
    ? <strong key={index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
    : <span key={index}>{part}</span>
));

export default function AssistantMessage({ message, onOption, onNavigate }) {
  const {
    content, steps, trail, links, options, filled, remaining, note, hint,
  } = message;

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] space-y-2 rounded-2xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
        {content && <p className="whitespace-pre-wrap">{emphasise(content)}</p>}

        {trail && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{trail}</p>
        )}

        {steps?.length > 0 && (
          <ol className="space-y-1.5 text-[13px]">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  {emphasise(step.text)}
                  {/* The caveat that stops somebody getting halfway and stuck. */}
                  {step.note && <span className="mt-0.5 block text-[11px] text-slate-400">{step.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* What the assistant understood, so a misreading is caught before the
            form is opened rather than after it is saved. */}
        {filled?.length > 0 && (
          <ul className="space-y-0.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[12px]">
            {filled.map((item) => (
              <li key={item.label} className="flex gap-1.5">
                <Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                <span className="text-slate-500">{item.label}:</span>
                <span className="min-w-0 truncate font-medium text-slate-700">{item.value}</span>
              </li>
            ))}
          </ul>
        )}

        {remaining?.length > 0 && (
          <p className="text-[11px] text-slate-400">
            Still yours to do: {remaining.join(' · ')}
          </p>
        )}

        {note && <p className="text-[11px] text-slate-400">{note}</p>}
        {hint && <p className="text-[11px] italic text-slate-400">{hint}</p>}

        {links?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={onNavigate}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-white"
                style={{ backgroundColor: 'var(--primary, #2563eb)' }}
              >
                {link.label} <ArrowRight size={12} />
              </Link>
            ))}
          </div>
        )}

        {options?.length > 0 && (
          <div className="space-y-1 pt-0.5">
            {options.map((option) => (
              <button
                key={option.query}
                type="button"
                onClick={() => onOption(option.query)}
                className="block w-full rounded-lg bg-slate-50 px-2.5 py-1.5 text-left text-[12px] text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
