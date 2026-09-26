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
      setSlides(
        (rows || [])
          .map((row) => ({ ...row, image: firstImageUrl(row.property?.images) }))
          .filter((row) => row.image && row.property?.id),
      );
    } catch {
      // An advert is never worth an error message. A company with no campaigns
      // and a request that failed should look the same to the person: no advert.
      setSlides([]);
    } finally {
      setLoading(false);
    }
  }, [audience]);

  useEffect(() => { load(); }, [load]);

  return { slides, loading, audience, reload: load };
}
