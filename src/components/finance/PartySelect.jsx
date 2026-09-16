import { useEffect, useMemo } from 'react';
import { listUsers } from '../../api/userApi';
import EntitySearchSelect from '../common/EntitySearchSelect';
import Select from '../ui/Select';
import FieldMark from '../ui/FieldMark';

/**
 * Picks the user a credit or debit note is raised against, in two steps: what
 * KIND of user, then which one.
 *
 * These forms used to demand a client. A note is just as legitimately raised
 * against a realtor — clawing back a commission — or against an employee, and
 * requiring a client left those cases with nowhere to go.
 *
 * Both dropdowns are company-scoped by the API: /users honours ?type= and
 * applies the caller's company scope itself, so this cannot list someone from
 * another company however it is called.
 */
const PARTY_TYPES = [
  { value: 'client', label: 'Client' },
  { value: 'realtor', label: 'Realtor' },
  { value: 'admin', label: 'Admin' },
  { value: 'employee', label: 'Employee' },
];

export default function PartySelect({ partyType, userId, onChange, required = false }) {
  const type = partyType || 'client';

  // Changing the kind of user invalidates the selected one — a client id is
  // meaningless once the list is showing realtors.
  useEffect(() => {
    if (userId) onChange({ party_type: type, client_id: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const label = useMemo(
    () => PARTY_TYPES.find((p) => p.value === type)?.label || 'User',
    [type],
  );

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Raised against<FieldMark /></span>
        <Select
          value={type}
          onChange={(e) => onChange({ party_type: e.target.value, client_id: '' })}
        >
          {PARTY_TYPES.map((party) => (
            <option key={party.value} value={party.value}>{party.label}</option>
          ))}
        </Select>
      </label>

      <EntitySearchSelect
        // Keyed on the type so the component refetches instead of showing the
        // previous kind's list until something is typed.
        key={type}
        label={label}
        placeholder={`Search ${label.toLowerCase()} by name…`}
        value={userId}
        onChange={(id) => onChange({ party_type: type, client_id: id })}
        fetchItems={() => listUsers({ type, limit: 1000 })}
        getLabel={(u) => u.name || u.email || `${label} #${u.id}`}
        required={required}
      />
    </div>
  );
}
