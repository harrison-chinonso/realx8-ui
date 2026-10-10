import { useEffect, useState } from 'react';
import { PLANS, TRIAL_DAYS } from './content/plans.js';
import { fetchPlans } from './api.js';

/*
 * One fetch per visit, shared by every page that shows plans. A failed fetch is
 * forgotten so the next page that needs plans tries again.
 */
let loaded = null;
let pending = null;

/**
 * The plans to show: the built-in copy at once, then the app's own plans from
 * GET /public/plans when (and only if) they arrive in a usable shape.
 */
export default function usePlans() {
  const [result, setResult] = useState(() => loaded || { plans: PLANS, trialDays: TRIAL_DAYS });

  useEffect(() => {
    if (loaded) return undefined;
    let live = true;
    if (!pending) {
      pending = fetchPlans().then((fetched) => {
        if (fetched) loaded = fetched;
        else pending = null;
        return fetched;
      });
    }
    pending.then((fetched) => { if (live && fetched) setResult(fetched); });
    return () => { live = false; };
  }, []);

  return result;
}
