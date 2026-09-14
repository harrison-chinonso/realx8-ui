/**
 * "1 deal" / "2 deals", rather than "1 deal(s)".
 *
 * The bracketed "(s)" is a shortcut taken while writing code, and it reads as
 * one: a person never writes it. It also fails in the only case that matters —
 * a count of exactly one, which is the most common count on a quiet screen.
 */
export const plural = (count, one, many = `${one}s`) =>
  `${count} ${Number(count) === 1 ? one : many}`;
