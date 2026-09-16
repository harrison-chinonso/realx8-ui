import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProperty, listPropertyTypes, listBranches } from '../../api/propertyApi';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import CompanySelect from '../../components/common/CompanySelect';
import PropertyMediaPanel from '../../components/common/PropertyMediaPanel';
import LocationFields from '../../components/common/LocationFields';
import PropertyUnitFields, { emptyUnitConfig } from '../../components/common/PropertyUnitFields';
import useAuthStore from '../../store/authStore';
import Select from '../../components/ui/Select';
import { useAssistantHandoff } from '../../assistant/useAssistantHandoff';
import FieldMark from '../../components/ui/FieldMark';

const COUNTRY_STATE_MAP = {
  Nigeria: ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'FCT'],
  'United States': ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  Canada: ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan'],
  'South Africa': ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'],
  Ghana: ['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'],
  Kenya: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi', 'Kitale', 'Garissa', 'Kakamega'],
  Australia: ['Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'],
  India: ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'],
  Other: ['N/A'],
};

const COUNTRIES = Object.keys(COUNTRY_STATE_MAP);

export default function CreatePropertyPage() {
  const navigate = useNavigate();
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    name: '',
    type_id: '',
    branch_id: '',
    type: '',
    address: '',
    country: '',
    state: '',
    city: '',
    status: 'available',
    description: '',
    company_id: '',
    latitude: '',
    longitude: '',
  });
  const [unitConfig, setUnitConfig] = useState(emptyUnitConfig);
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  // From the assistant. Only the name — everything that carries a price, a
  // location or a unit count is typed here, where it can be checked.
  const handoff = useAssistantHandoff('create-property');
  useEffect(() => {
    if (handoff?.name) setForm((prev) => ({ ...prev, name: handoff.name }));
  }, [handoff]);
  const [error, setError] = useState('');

  useEffect(() => {
    listPropertyTypes({ limit: 100 })
      .then((response) => {
        const items = Array.isArray(response) ? response : (response?.data ?? []);
        setPropertyTypes(items);
      })
      .catch(() => setPropertyTypes([]));

    // A failure here leaves the dropdown empty and the property unassigned,
    // which is recoverable on the property afterwards — it must not stop
    // somebody creating the property.
    listBranches({ limit: 'all' })
      .then((response) => {
        const items = Array.isArray(response) ? response : (response?.data ?? []);
        setBranches(items);
      })
      .catch(() => setBranches([]));
  }, []);

  const states = form.country ? (COUNTRY_STATE_MAP[form.country] || []) : [];
  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const setValue = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const handleCountryChange = (event) => setForm((current) => ({ ...current, country: event.target.value, state: '', city: '' }));
  const handleStateChange = (event) => setForm((current) => ({ ...current, state: event.target.value, city: '' }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Property name is required.');
      return;
    }
    if (isSuperiorAdmin && !form.company_id) {
      setError('Company is required.');
      return;
    }

    const hasUnitConfig = ['name', 'size', 'price', 'quantity'].some((key) => String(unitConfig[key] ?? '').trim() !== '');

    setSaving(true);
    setError('');
    try {
      const selectedType = propertyTypes.find((item) => String(item.id) === String(form.type_id));
      const payload = {
        ...form,
        type: selectedType?.name || form.type || '',
        latitude: form.latitude === '' ? null : form.latitude,
        longitude: form.longitude === '' ? null : form.longitude,
        // Price and size belong to the unit configuration; the backend derives
        // the property's "from" price from these.
        units: hasUnitConfig ? [{
          name: unitConfig.name?.trim() || undefined,
          size: unitConfig.size === '' ? null : Number(unitConfig.size),
          unit: unitConfig.unit || 'sqm',
          price: unitConfig.price === '' ? 0 : Number(unitConfig.price),
          quantity: unitConfig.quantity === '' ? 1 : Number(unitConfig.quantity),
        }] : [],
        ...(form.company_id ? { company_id: Number(form.company_id) } : {}),
        // Explicit rather than carried by the spread: "" is how the form says
        // "no branch", and null is how the server hears it.
        branch_id: form.branch_id === '' ? null : Number(form.branch_id),
        images: images.length > 0 ? images : undefined,
      };
      const response = await createProperty(payload);
      const id = response?.data?.id ?? response?.id;
      navigate(`/properties/${id}`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create property.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Create Property</h1>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-5">
        <CompanySelect value={form.company_id} onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))} />

        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Property Name" value={form.name} onChange={setField('name')} required />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Property Type<FieldMark /></label>
            <div className="relative">
              <Select
                value={form.type_id}
                onChange={setField('type_id')}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select type...</option>
                {propertyTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </Select>
            </div>
          </div>
          {/*
            Optional, and it says so. A company with no branches yet must not be
            stopped here, and a property that belongs to no particular office is
            an ordinary state rather than an omission.
          */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              Branch<FieldMark />
            </label>
            <div className="relative">
              <Select
                value={form.branch_id}
                onChange={setField('branch_id')}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">No branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </Select>
            </div>
            {branches.length === 0 && (
              <p className="text-xs text-slate-400">
                No branches set up yet — add them under Property → Branches.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Status<FieldMark /></label>
            <div className="relative">
              <Select
                value={form.status}
                onChange={setField('status')}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="available">Available</option>
                <option value="draft">Draft</option>
                <option value="sold">Sold</option>
                <option value="rented">Rented</option>
              </Select>
            </div>
          </div>
        </div>

        <Input label="Address" value={form.address} onChange={setField('address')} />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Country<FieldMark /></label>
            <div className="relative">
              <Select
                value={form.country}
                onChange={handleCountryChange}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select country...</option>
                {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">State / Region<FieldMark /></label>
            <div className="relative">
              <Select
                value={form.state}
                onChange={handleStateChange}
                disabled={!form.country || !states.length}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">Select state...</option>
                {states.map((state) => <option key={state} value={state}>{state}</option>)}
              </Select>
            </div>
          </div>
          <Input label="City" value={form.city} onChange={setField('city')} disabled={!form.state} />
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Unit Breakdown</p>
          <p className="text-xs text-slate-500">
            The first unit configuration for this property. You can add more configurations from the
            property&apos;s Manage Units tab after it is created.
          </p>
          <PropertyUnitFields value={unitConfig} onChange={setUnitConfig} />
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Map Location</p>
          <LocationFields
            latitude={form.latitude}
            longitude={form.longitude}
            onChange={setValue}
            label={form.name || 'New property'}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Description<FieldMark /></label>
          <textarea
            rows={4}
            value={form.description}
            onChange={setField('description')}
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Describe the property..."
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Media <span className="font-normal text-slate-400">(optional)</span></p>
          <PropertyMediaPanel images={images} onChange={setImages} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Property'}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/properties')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
