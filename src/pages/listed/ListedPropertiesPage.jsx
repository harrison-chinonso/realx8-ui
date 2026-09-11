import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listListedProperties, getPropertyShareLink } from '../../api/propertyApi';
import PropertyCard from '../../components/common/PropertyCard';
import ShareLinkPanel from '../../components/common/ShareLinkPanel';
import { publicUrlFor } from '../../components/common/PublicLinkPanel';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import useShareToken from '../../hooks/useShareToken';
import useAuthStore from '../../store/authStore';

const EMPTY = { data: [], pagination: { page: 1, totalPages: 1, total: 0 } };
const PAGE_SIZE = 12;

/**
 * Read-only catalogue of approved, available properties for realtors and
 * clients. There is intentionally no create/edit/delete affordance here — the
 * backing endpoint exposes reads only.
 */
export default function ListedPropertiesPage() {
  const navigate = useNavigate();
  const noCompany = useAuthStore((s) => s.company_id) == null && !useAuthStore.getState().isSuperiorAdmin;
  /**
   * The short code where the server offers one, the sealed token otherwise.
   * Both resolve to the same thing; the code is what keeps the URL short enough
   * to paste into a chat without it looking alarming.
   */
  const { token: sealedToken, code: shortCode } = useShareToken();
  const shareToken = shortCode || sealedToken;
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(null);   // { name, url } once a link is ready
  const [sharing, setSharing] = useState(null);
  const [shareError, setShareError] = useState('');

  // A new search starts the list over; without this, page 2 of an old query
  // would append onto results for the new one.
  useEffect(() => { setPage(1); }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listListedProperties({ search: query, page, limit: PAGE_SIZE })
      .then((response) => {
        if (cancelled) return;
        const next = response ?? EMPTY;
        // Append rather than replace: this catalogue grows downward instead of
        // paging, so no property is ever stranded behind a next button.
        setResult((prev) => (page === 1
          ? next
          : { ...next, data: [...(prev.data || []), ...(next.data || [])] }));
      })
      .catch(() => { if (!cancelled && page === 1) setResult(EMPTY); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, page]);

  const items = result.data || [];
  const total = result.pagination?.total ?? items.length;
  const hasMore = items.length < total;

  const handleShare = async (property) => {
    setSharing(property.id);
    setShareError('');
    try {
      const data = (await getPropertyShareLink(property.id))?.data ?? {};
      if (!data.public_token) throw new Error('No share link was returned.');
      const url = publicUrlFor(data.public_token, data.company_code, data.realtor_code, shareToken);
      // Use the native share sheet on mobile; fall back to a copyable panel.
      if (navigator.share) {
        try {
          await navigator.share({ title: property.name, url });
          return;
        } catch {
          // Dismissed or unsupported — fall through to the copy panel.
        }
      }
      setShare({ name: property.name, url });
    } catch (error) {
      setShareError(error?.userMessage || 'Could not create a share link for this property.');
    } finally {
      setSharing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-end md:justify-between">
        <div className="flex-1">
          <Input
            label="Search listed properties"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search by name, city, state, type..."
          />
        </div>
        <p className="text-sm text-slate-500">
          {result.pagination?.total ?? 0} approved propert{(result.pagination?.total ?? 0) === 1 ? 'y' : 'ies'} available
        </p>
      </div>

      {shareError && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{shareError}</div>}

      {share && <ShareLinkPanel share={share} onClose={() => setShare(null)} />}

      {/* Only take over the page while there is nothing to show yet — a
          "Show more" fetch must not blank the cards already on screen. */}
      {loading && !items.length ? (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
          Loading properties...
        </div>
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onOpen={() => navigate(`/properties/listed/${property.id}`)}
              onShare={() => handleShare(property)}
              summaryMode="units"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
          {/* Same distinction as the detail page: an account attached to no
              company has nothing to browse, and saying so is more use than
              implying the company has listed nothing. */}
          {noCompany
            ? 'Your account is not linked to a company yet, so there are no properties to browse. Ask an administrator to attach it.'
            : query ? 'No properties match your search.' : 'No approved properties are available yet.'}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-slate-400">
            Showing {items.length} of {total} {total === 1 ? 'property' : 'properties'}
          </p>
          {hasMore && (
            <Button type="button" variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={loading}>
              {loading ? 'Loading…' : 'Show more properties'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
