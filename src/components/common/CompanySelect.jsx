import { useEffect, useState } from 'react';
import { listCompanies } from '../../api/companyApi';
import useAuthStore from '../../store/authStore';
import Select from '../ui/Select';
import FieldMark from '../ui/FieldMark';

export default function CompanySelect({ value, onChange, required = true, label = 'Company' }) {
  const { user } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const isSuperiorAdmin = user?.isSuperiorAdmin || user?.type === 'superior_admin';

  useEffect(() => {
    if (isSuperiorAdmin) {
      listCompanies({ limit: 200 })
        .then((r) => setCompanies(Array.isArray(r) ? r : (r?.data ?? [])))
        .catch(() => {});
    }
  }, [isSuperiorAdmin]);

  if (!isSuperiorAdmin) return null;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}<FieldMark required={Boolean(required)} /></label>
      <div className="relative">
        <Select
          value={value}
          onChange={onChange}
          required={required}
          className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Select company...</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
    </div>
  );
}
