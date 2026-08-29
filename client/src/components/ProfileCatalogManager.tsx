import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, ShieldCheck, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { apiRequest } from '../lib/auth';

type ProfileField = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
  status: string;
};

type OptionItem = {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  status: string;
};

type Catalog = {
  profileFields: ProfileField[];
  optionLists: Array<{ id: string; key: string; label: string; items: OptionItem[] }>;
};

export default function ProfileCatalogManager() {
  const [catalog, setCatalog] = useState<Catalog>({ profileFields: [], optionLists: [] });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newField, setNewField] = useState({ key: '', label: '', description: '' });
  const [newOption, setNewOption] = useState('');

  const contactList = useMemo(
    () => catalog.optionLists.find(list => list.key === 'contact_relationships'),
    [catalog.optionLists],
  );

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/profile-catalog?include_inactive=true');
      if (!response.ok) throw new Error('Unable to load profile catalog');
      setCatalog(await response.json());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load profile catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const saveField = async (field: ProfileField, patch: Partial<ProfileField>) => {
    setSavingId(field.id);
    try {
      const response = await apiRequest(`/api/profile-catalog/fields/${field.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to save field');
      const updated = await response.json();
      setCatalog(prev => ({ ...prev, profileFields: prev.profileFields.map(item => item.id === updated.id ? updated : item) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save field');
    } finally {
      setSavingId(null);
    }
  };

  const createField = async () => {
    if (!newField.label.trim()) return setError('Enter a label for the new field.');
    setSavingId('new-field');
    try {
      const response = await apiRequest('/api/profile-catalog/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newField),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to create field');
      const created = await response.json();
      setCatalog(prev => ({ ...prev, profileFields: [...prev.profileFields, created].sort((a, b) => a.sort_order - b.sort_order) }));
      setNewField({ key: '', label: '', description: '' });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create field');
    } finally {
      setSavingId(null);
    }
  };

  const saveOption = async (item: OptionItem, patch: Partial<OptionItem>) => {
    setSavingId(item.id);
    try {
      const response = await apiRequest(`/api/profile-catalog/options/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to save option');
      const updated = await response.json();
      setCatalog(prev => ({
        ...prev,
        optionLists: prev.optionLists.map(list => ({
          ...list,
          items: list.items.map(option => option.id === updated.id ? updated : option),
        })),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save option');
    } finally {
      setSavingId(null);
    }
  };

  const createOption = async () => {
    if (!contactList || !newOption.trim()) return;
    setSavingId('new-option');
    try {
      const response = await apiRequest(`/api/profile-catalog/option-lists/${contactList.key}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newOption }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to create option');
      const created = await response.json();
      setCatalog(prev => ({
        ...prev,
        optionLists: prev.optionLists.map(list => list.id === contactList.id ? { ...list, items: [...list.items, created].sort((a, b) => a.sort_order - b.sort_order) } : list),
      }));
      setNewOption('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create option');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading profile catalog...</div>;

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-blue-600 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Profile Catalog</h2>
            <p className="text-sm text-gray-600 mt-1">Manage the Support Information labels and reusable contact options used across profiles.</p>
          </div>
        </div>
        {error && <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700"><span>{error}</span><button onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}
      </div>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Profile fields</h3>
            <p className="text-xs text-gray-500 mt-1">Inactive fields stay stored so their existing values are not lost.</p>
          </div>
        </div>
        <div className="space-y-3">
          {catalog.profileFields.map(field => (
            <div key={field.id} className={`rounded-xl border p-3 ${field.status === 'active' ? 'border-gray-200' : 'border-dashed border-gray-300 bg-gray-50'}`}>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_100px_120px_auto] gap-2 items-center">
                <input
                  aria-label={`${field.key} label`}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={field.label}
                  onChange={e => setCatalog(prev => ({ ...prev, profileFields: prev.profileFields.map(item => item.id === field.id ? { ...item, label: e.target.value } : item) }))}
                />
                <input
                  aria-label={`${field.key} description`}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={field.description || ''}
                  placeholder="Description"
                  onChange={e => setCatalog(prev => ({ ...prev, profileFields: prev.profileFields.map(item => item.id === field.id ? { ...item, description: e.target.value } : item) }))}
                />
                <input
                  aria-label={`${field.key} order`}
                  type="number"
                  min="0"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={field.sort_order}
                  onChange={e => setCatalog(prev => ({ ...prev, profileFields: prev.profileFields.map(item => item.id === field.id ? { ...item, sort_order: Number(e.target.value) } : item) }))}
                />
                <button
                  onClick={() => saveField(field, { status: field.status === 'active' ? 'inactive' : 'active' })}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium ${field.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                >
                  {field.status === 'active' ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {field.status === 'active' ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => saveField(field, { label: field.label, description: field.description, sort_order: field.sort_order })}
                  disabled={savingId === field.id}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 text-white px-3 py-2 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Key: {field.key} · String list · Super Scooper profiles</p>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Add a field</h4>
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr_auto] gap-2">
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Key (optional)" value={newField.key} onChange={e => setNewField(prev => ({ ...prev, key: e.target.value }))} />
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Field label" value={newField.label} onChange={e => setNewField(prev => ({ ...prev, label: e.target.value }))} />
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Description (optional)" value={newField.description} onChange={e => setNewField(prev => ({ ...prev, description: e.target.value }))} />
            <button onClick={createField} disabled={savingId === 'new-field'} className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"><Plus className="h-4 w-4" /> Add</button>
          </div>
        </div>
      </section>

      {contactList && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900">Contact relationship options</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">Inactive options are hidden from new contact edits but remain valid for existing contacts.</p>
          <div className="space-y-2">
            {contactList.items.map(item => (
              <div key={item.id} className="grid grid-cols-[1fr_90px_110px_auto] gap-2 items-center">
                <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={item.label} onChange={e => setCatalog(prev => ({ ...prev, optionLists: prev.optionLists.map(list => list.id === contactList.id ? { ...list, items: list.items.map(option => option.id === item.id ? { ...option, label: e.target.value } : option) } : list) }))} />
                <input type="number" min="0" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={item.sort_order} onChange={e => setCatalog(prev => ({ ...prev, optionLists: prev.optionLists.map(list => list.id === contactList.id ? { ...list, items: list.items.map(option => option.id === item.id ? { ...option, sort_order: Number(e.target.value) } : option) } : list) }))} />
                <button onClick={() => saveOption(item, { status: item.status === 'active' ? 'inactive' : 'active' })} className={`rounded-lg px-3 py-2 text-xs font-medium ${item.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{item.status === 'active' ? 'Active' : 'Inactive'}</button>
                <button onClick={() => saveOption(item, { label: item.label, sort_order: item.sort_order })} disabled={savingId === item.id} className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 text-white px-3 py-2 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save</button>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
            <input className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="New relationship option" value={newOption} onChange={e => setNewOption(e.target.value)} />
            <button onClick={createOption} disabled={savingId === 'new-option'} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"><Plus className="h-4 w-4" /> Add option</button>
          </div>
        </section>
      )}
    </div>
  );
}