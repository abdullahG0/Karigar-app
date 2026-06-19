import { useEffect, useState, FormEvent } from 'react';
import { Plus } from 'lucide-react';
import api from '../api';

interface Category {
  id: string;
  name: string;
  icon_name: string;
  description: string;
  base_price_range: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', icon_name: '', description: '', base_price_range: '' });

  const load = () =>
    api.get('/categories').then(r => setCategories(r.data)).catch(() => setCategories([]));

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await api.post('/categories', form);
    setForm({ name: '', icon_name: '', description: '', base_price_range: '' });
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Service Categories</h1>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-6 grid grid-cols-2 gap-4">
          {(['name', 'icon_name', 'description', 'base_price_range'] as const).map(field => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 capitalize">{field.replace('_', ' ')}</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                required={field === 'name' || field === 'icon_name'}
              />
            </div>
          ))}
          <div className="col-span-2 flex gap-3">
            <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium">
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map(c => (
          <div key={c.id} className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{c.icon_name}</span>
              <h3 className="font-semibold text-lg">{c.name}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">{c.description}</p>
            <p className="text-xs text-gray-400">Price range: {c.base_price_range || 'N/A'}</p>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-gray-400 col-span-full text-center py-8">No categories yet</p>
        )}
      </div>
    </div>
  );
}
