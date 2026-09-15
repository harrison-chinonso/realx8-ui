import appMap from './app-map.generated.json' with { type: 'json' };
import { financeRecipes } from './recipes/finance.js';
import { commissionRecipes } from './recipes/commission.js';
import { propertyRecipes } from './recipes/property.js';
import { peopleRecipes } from './recipes/people.js';

/**
 * Everything the assistant knows, in one place.
 *
 * The app map is GENERATED from navConfig and the router — see
 * scripts/build-assistant-kb.mjs — so screen names and paths cannot drift from
 * the code. The recipes are hand-written against those same screens, and the
 * integrity test refuses any whose route is not in the map.
 */
export const recipes = [
  ...financeRecipes,
  ...commissionRecipes,
  ...propertyRecipes,
  ...peopleRecipes,
];

export { appMap };
