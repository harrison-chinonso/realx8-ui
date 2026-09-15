import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * The other half of an action: the screen reading what the assistant sent.
 *
 * ── Why the values travel in the URL ────────────────────────────────────────
 *
 * A shared store would be quicker to write and worse to live with. The link the
 * assistant produces is a real link — it can be opened in a new tab, pasted to a
 * colleague, or arrived at by the back button — and all of those have to behave
 * the same as clicking it. Putting the values in the query string is what makes
 * that true, and it costs nothing else.
 *
 * ── Why the parameters are cleared after they are read ──────────────────────
 *
 * They are an instruction, not state. Left in place, closing the prefilled form
 * and pressing refresh reopens it — and a form that will not stay shut is worse
 * than one that never opened. The hand-off fires once, then the URL goes back
 * to being an ordinary address for the page.
 *
 * @param {string} id  the action id this screen answers to, e.g. 'create-user'
 * @returns {object|null}  the values it was sent, once, or null
 */
export const useAssistantHandoff = (id) => {
  const location = useLocation();
  const navigate = useNavigate();
  const consumed = useRef(null);

  const handoff = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('assist') !== id) return null;

    const values = {};
    params.forEach((value, key) => { if (key !== 'assist') values[key] = value; });
    return values;
  }, [location.search, id]);

  useEffect(() => {
    if (!handoff) return;
    /*
     * Guarded against a second run. In StrictMode every effect runs twice, and
     * without this the form would be opened, closed by the clean-up, and
     * reopened — which reads as a flicker and loses anything typed in between.
     */
    const key = location.search;
    if (consumed.current === key) return;
    consumed.current = key;

    // `replace`, so the back button goes where the person came from rather than
    // to the same page with the instruction still attached.
    navigate(location.pathname, { replace: true });
  }, [handoff, location.pathname, location.search, navigate]);

  // Returned on the first render, before the URL is cleaned — the caller copies
  // it into its own state, which is where it lives from then on.
  return handoff;
};

export default useAssistantHandoff;
