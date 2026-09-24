import { useEffect, useState } from 'react';
import client from '../api/client';
import useAuthStore from '../store/authStore';

/**
 * The company a platform admin is creating somebody INTO.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 *
 * Every account except a platform admin's own must belong to a company, and the
 * server takes that company from the CALLER — which works for a company
 * administrator and leaves a platform admin, who belongs to no company, unable
 * to create a single user anywhere. Every create form refused with
 * "company_id is required for non-superior-admin users", a sentence naming a
 * field that appeared on none of them.
 *
 * So the field appears, for the one account that has to answer it. Everybody
 * else gets `{ needed: false }` and no extra request: their company is implied
 * and the server pins them to it whatever they send.
 */
export default function useCompanyChoice() {
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    if (!isSuperiorAdmin) return;
    client.get('/companies')
      .then((r) => {
        const list = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
        setCompanies(list);
      })
      .catch(() => setCompanies([]));
  }, [isSuperiorAdmin]);

  return { needed: Boolean(isSuperiorAdmin), companies };
}
