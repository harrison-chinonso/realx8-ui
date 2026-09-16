/**
 * The mark after a field's name saying whether it has to be filled in.
 *
 * ── Why both marks, and not just the asterisk ───────────────────────────────
 *
 * A red asterisk on some fields tells you those are required. It does NOT tell
 * you the rest are optional — it leaves you to infer it, and the inference is
 * wrong often enough that people fill in everything to be safe, or abandon a
 * form because they cannot supply something that was never needed. Marking both
 * sides removes the guess: every field says which it is.
 *
 * ── Why one component rather than a span at each call site ──────────────────
 *
 * There are over three hundred field labels here. Written inline, the colour,
 * the spacing and the wording would be three hundred chances to drift, and the
 * asterisk would end up red in most places and slate in a few.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * The asterisk is decorative and hidden from assistive technology: a screen
 * reader announcing "star" after every label is noise, and the control's own
 * `required` attribute already carries that meaning properly. "(optional)" is
 * NOT hidden — nothing else conveys it, and it is the half a screen-reader user
 * has no other way to learn.
 */
import { Children, isValidElement } from 'react';

/**
 * Whether the control a label wraps is required.
 *
 * For the `Field` wrappers that take `{ label, children }`: the answer is
 * already on the input they were handed, and reading it there means no call
 * site has to repeat itself and no wrapper can drift from the validation it
 * describes.
 */
export const requiredFromChildren = (children) => Children.toArray(children)
  .some((child) => isValidElement(child) && Boolean(child.props?.required));

export default function FieldMark({ required = false, className = '' }) {
  if (required) {
    return (
      <span aria-hidden="true" className={`ml-0.5 text-danger ${className}`}>*</span>
    );
  }
  return (
    <span className={`ml-1 font-normal text-content-subtle ${className}`}>(optional)</span>
  );
}
