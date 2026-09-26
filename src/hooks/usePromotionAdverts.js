import { useCallback, useEffect, useState } from 'react';
import { listPromotionShowcase } from '../api/promotionApi';
import { firstImageUrl } from '../utils/parseImages';
import useAuthStore from '../store/authStore';

/**
 * The promoted properties to advertise, already reduced to what a slide needs.
 *
 * ── Photos only ─────────────────────────────────────────────────────────────
 *
 * A slide is a picture with an offer under it, so a property with no photograph
 * has no slide — a video cannot be a still advert and a placeholder glyph
 * beside real photographs reads as a broken listing. The filtering happens
 * here, with `firstImageUrl`, which is the same helper the property cards use:
 * the server sends the raw `images` array precisely so this rule lives in one
 * place rather than being re-implemented in SQL and drifting.
 *
 * ── Who sees it ─────────────────────────────────────────────────────────────
 *
 * Clients and realtors. Staff have the Promotions screen, which is the real
 * thing rather than an advert for it, and a platform admin has no company whose
 * offers these would be. The hook returns nothing for anyone else rather than
 * each caller repeating the test.
 */
export default function usePromotionAdverts() {
  const effectiveType = useAuthStore((state) => state.effectiveType());
  const audience = effectiveType === 'client' || effectiveType === 'realtor';

  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(audience);

  const load = useCallback(async () => {
    if (!audience) { setSlides([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await listPromotionShowcase();
      const withImages = (rows || [])
        .map((row) => ({ ...row, image: firstImageUrl(row.property?.images) }))
        .filter((row) => row.image && row.property?.id);

      /*
       * Say so when offers arrived but every one was discarded. Silence here is
       * indistinguishable from "no campaigns", and the difference matters: it
       * means the promotion is configured and live but its property has no
       * photograph, so the advert can never appear however many campaigns get
       * created. Console only — it is a note for whoever is debugging, not a
       * problem the person reading the dashboard can act on.
       */
      if (rows?.length && !withImages.length) {
        console.warn(
          `[adverts] ${rows.length} promoted propert${rows.length === 1 ? 'y' : 'ies'} returned, `
          + 'but none had a usable photograph — nothing will be advertised. '
          + 'Promoted properties need at least one image (not a video) to appear.',
        );
      }
      setSlides(withImages);
    } catch (error) {
      /*
       * The advert stays silent for the person — a failed request and a company
       * with no campaigns should look identical to them, which is a blank space
       * rather than an error about something they did not ask for.
       *
       * But it must not be silent for a developer. This swallow is what made a
       * staging deployment with live promotions and no carousel impossible to
       * diagnose from the browser: no advert, no error, nothing to go on. The
       * status is the whole diagnosis — 404 means the backend does not have the
       * endpoint (Core not redeployed), 403 means the account lacks
       * properties.view, 200 means look at the promotion's own configuration.
       */
      const status = error?.response?.status;
      console.warn(
        `[adverts] could not load promoted properties${status ? ` (HTTP ${status})` : ''}: `
        + `${error?.response?.data?.message || error?.message || 'unknown error'}`,
      );
      setSlides([]);
    } finally {
      setLoading(false);
    }
  }, [audience]);

  useEffect(() => { load(); }, [load]);

  return { slides, loading, audience, reload: load };
}
