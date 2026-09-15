import { buildEngine, ask } from './engine.js';
import { appMap, recipes } from './kb/index.js';
import { actions } from './actions/defs/index.js';
import { resolveAction, answerSlot } from './actions/resolve.js';

/**
 * The assistant, assembled.
 *
 * Built once per page: the corpus is static for the life of the session, and
 * re-indexing a few hundred short documents on every keystroke would be felt.
 */
let engine = null;

export const getEngine = () => {
  if (!engine) engine = buildEngine({ appMap, recipes, actions });
  return engine;
};

export { ask, resolveAction, answerSlot, appMap, recipes, actions };
