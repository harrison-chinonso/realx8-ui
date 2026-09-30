import { resolveMedia } from '../../utils/mediaUrl';

/**
 * The few figures every property page derives from its units, in one place so
 * a card, a header and a table cannot disagree about them.
 *
 * All of them read what the list and detail endpoints already send —
 * `quantity`, `quantity_available`, `quantity_held`, `price`, and the
 * `plan_summary` / per-unit `plans` the server adds — so none costs a request.
 */

/** What is left of a configuration: configured quantity less units secured by payments. */
export const availableOf = (unit) => Number(unit?.quantity_available ?? unit?.quantity) || 0;

/** Units across every configuration: configured, still for sale, and held. */
export const stockOf = (units = [], property = {}) => {
  if (!units.length) {
    const total = Number(property.unit_quantity) || 0;
    return { total, available: total, held: 0 };
  }
  return units.reduce((acc, unit) => {
    acc.total += Number(unit.quantity) || 0;
    acc.available += availableOf(unit);
    acc.held += Number(unit.quantity_held) || 0;
    return acc;
  }, { total: 0, available: 0, held: 0 });
};

/** The cheapest and dearest configuration, ignoring unpriced ones. */
export const priceRangeOf = (units = []) => {
  const prices = units.map((u) => Number(u.price) || 0).filter((p) => p > 0);
  if (!prices.length) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

/** Share of stock already gone, for an availability bar — 0 to 100. */
export const soldPercent = ({ total, available }) => (total > 0 ? Math.round(((total - available) / total) * 100) : 0);

/** How many photos (not videos) a property's media list holds — classified by resolveMedia, like the media panel. */
export const photoCountOf = (media = []) => (Array.isArray(media) ? media : [])
  .filter((item) => {
    const url = typeof item === 'string' ? item : item?.url;
    return url && resolveMedia(url, typeof item === 'string' ? undefined : item?.type)?.kind === 'image';
  }).length;
