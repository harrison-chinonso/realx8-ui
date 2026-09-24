import Select from '../ui/Select';
import useCompanyChoice from '../../hooks/useCompanyChoice';

/**
 * "Which company?" — asked of a platform admin, of nobody else.
 *
 * Renders nothing at all for a company administrator: their own company is the
 * only answer and the server pins them to it regardless of what is sent. See
 * useCompanyChoice for why a platform admin could otherwise create no users.
 */
export default function CompanyField({ value, onChange, disabled = false }) {
  const { needed, companies } = useCompanyChoice();
  if (!needed) return null;

  return (
    <div>
      <Select
        label="Company"
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        required
        placeholder="Choose a company"
      >
        <option value="">Choose a company</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <p className="mt-1 text-xs text-content-subtle">
        Every account belongs to a company. Yours is the platform, so this one has to be chosen.
      </p>
    </div>
  );
}
