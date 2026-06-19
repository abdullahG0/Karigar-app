import { useEffect, useState, useMemo } from 'react';
import { Search, CheckCircle, XCircle, PauseCircle, Star, Plus, Pencil, Trash2, X } from 'lucide-react';
import api from '../api/client';

interface Category { id: string; name: string }

interface Professional {
  id: string;
  name: string;
  phone: string;
  rating: number;
  total_jobs: number;
  is_verified: boolean;
  is_available: boolean;
  created_at: string;
  categories: Category[];
}

interface FormState {
  name: string;
  phone: string;
  password: string;
  bio: string;
  hourly_rate: string;
  category_ids: string[];
  is_verified: boolean;
  is_available: boolean;
  society_id: string;
}

const EMPTY_FORM: FormState = {
  name: '', phone: '', password: '', bio: '',
  hourly_rate: '', category_ids: [],
  is_verified: false, is_available: true,
  society_id: 'soc_pvc_isl',
};

export default function ProfessionalsPage() {
  const [pros, setPros]           = useState<Professional[]>([]);
  const [allCats, setAllCats]     = useState<Category[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [busy, setBusy]           = useState<Record<string, boolean>>({});

  // Modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Professional | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [formErr, setFormErr]     = useState('');
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/admin/professionals'),
      api.get('/categories'),
    ]).then(([pRes, cRes]) => {
      setPros(pRes.data ?? []);
      setAllCats(cRes.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return pros;
    return pros.filter(
      (p) => p.name.toLowerCase().includes(q) || p.phone.includes(q),
    );
  }, [pros, search]);

  // ── Modal helpers ────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormErr('');
    setEditTarget(null);
    setModalMode('add');
  }

  function openEdit(p: Professional) {
    setForm({
      name:        p.name,
      phone:       p.phone,
      password:    '',
      bio:         '',
      hourly_rate: '',
      category_ids: p.categories.map((c) => c.id),
      is_verified:  p.is_verified,
      is_available: p.is_available,
      society_id:   'soc_pvc_isl',
    });
    setFormErr('');
    setEditTarget(p);
    setModalMode('edit');
  }

  function closeModal() {
    setModalMode(null);
    setEditTarget(null);
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleCat(catId: string) {
    setForm((f) => ({
      ...f,
      category_ids: f.category_ids.includes(catId)
        ? f.category_ids.filter((id) => id !== catId)
        : [...f.category_ids, catId],
    }));
  }

  // ── Save (Add / Edit) ────────────────────────────────────────────────────────

  async function handleSave() {
    setFormErr('');
    if (!form.name.trim()) { setFormErr('Name is required.'); return; }
    if (!form.phone.trim()) { setFormErr('Phone is required.'); return; }
    if (modalMode === 'add' && !form.password.trim()) { setFormErr('Password is required.'); return; }
    if (form.category_ids.length === 0) { setFormErr('Select at least one skill.'); return; }

    setSaving(true);
    try {
      if (modalMode === 'add') {
        await api.post('/admin/professionals', {
          name:         form.name.trim(),
          phone:        form.phone.trim(),
          password:     form.password.trim(),
          bio:          form.bio.trim() || undefined,
          hourly_rate:  form.hourly_rate ? Number(form.hourly_rate) : 0,
          category_ids: form.category_ids,
          is_verified:  form.is_verified,
          society_id:   form.society_id,
        });
        // Refresh list
        const fresh = await api.get('/admin/professionals');
        setPros(fresh.data ?? []);
        closeModal();
      } else if (editTarget) {
        const body: Record<string, unknown> = {
          name:         form.name.trim(),
          phone:        form.phone.trim(),
          category_ids: form.category_ids,
          is_verified:  form.is_verified,
          is_available: form.is_available,
        };
        if (form.bio.trim())         body.bio         = form.bio.trim();
        if (form.hourly_rate.trim()) body.hourly_rate = Number(form.hourly_rate);
        if (form.password.trim())    body.password    = form.password.trim();

        await api.patch(`/admin/professionals/${editTarget.id}`, body);
        const fresh = await api.get('/admin/professionals');
        setPros(fresh.data ?? []);
        closeModal();
      }
    } catch (err: any) {
      setFormErr(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete(p: Professional) {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    setBusy((b) => ({ ...b, [p.id]: true }));
    try {
      await api.delete(`/admin/professionals/${p.id}`);
      setPros((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err: any) {
      alert(err.message ?? 'Could not delete professional.');
    } finally {
      setBusy((b) => ({ ...b, [p.id]: false }));
    }
  }

  // ── Existing actions ─────────────────────────────────────────────────────────

  async function toggleVerify(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const { data } = await api.patch(`/admin/professionals/${id}/verify`);
      setPros((prev) => prev.map((p) => (p.id === id ? { ...p, is_verified: data.is_verified } : p)));
    } catch { /* keep stale */ }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  async function suspend(id: string) {
    if (!confirm('Suspend this professional? They will no longer appear as available.')) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.patch(`/admin/professionals/${id}/suspend`);
      setPros((prev) => prev.map((p) => (p.id === id ? { ...p, is_available: false } : p)));
    } catch { /* keep stale */ }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Professionals</h1>
          <p className="text-sm text-gray-500 mt-1">{pros.length} registered</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Professional
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Phone', 'Skills', 'Rating', 'Jobs', 'Verified', 'Available', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">No professionals found</td>
                </tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/60 align-middle">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{p.name}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.phone}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {p.categories.length === 0 ? (
                        <span className="text-gray-400 text-xs">—</span>
                      ) : p.categories.slice(0, 2).map((c) => (
                        <span key={c.id} className="bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          {c.name}
                        </span>
                      ))}
                      {p.categories.length > 2 && (
                        <span className="text-gray-400 text-xs">+{p.categories.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-gray-700">
                      <Star size={13} className="text-yellow-400 fill-yellow-400" />
                      {p.rating > 0 ? p.rating.toFixed(1) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.total_jobs}</td>
                  <td className="px-4 py-3">
                    {p.is_verified
                      ? <CheckCircle size={17} className="text-green-500" />
                      : <XCircle    size={17} className="text-gray-300" />}
                  </td>
                  <td className="px-4 py-3">
                    {p.is_available
                      ? <CheckCircle size={17} className="text-brand-500" />
                      : <XCircle    size={17} className="text-red-400" />}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Verify toggle */}
                      <button
                        disabled={busy[p.id]}
                        onClick={() => toggleVerify(p.id)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors border disabled:opacity-50 ${
                          p.is_verified
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'
                            : 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200'
                        }`}
                      >
                        {p.is_verified ? 'Unverify' : 'Verify'}
                      </button>

                      {/* Suspend */}
                      {p.is_available && (
                        <button
                          disabled={busy[p.id]}
                          onClick={() => suspend(p.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          <PauseCircle size={13} /> Suspend
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        disabled={busy[p.id]}
                        onClick={() => openEdit(p)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Pencil size={13} /> Edit
                      </button>

                      {/* Delete */}
                      <button
                        disabled={busy[p.id]}
                        onClick={() => handleDelete(p)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />

          {/* Sheet */}
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {modalMode === 'add' ? 'Add Professional' : `Edit — ${editTarget?.name}`}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
              {formErr && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {formErr}
                </div>
              )}

              {/* Name & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Asif Mehmood"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone *</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="+92300000000"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Password {modalMode === 'edit' ? '(leave blank to keep unchanged)' : '*'}
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder={modalMode === 'edit' ? '••••••••' : 'Min 8 characters'}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Bio {modalMode === 'edit' && '(leave blank to keep unchanged)'}
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="Brief professional background…"
                  value={form.bio}
                  onChange={(e) => setField('bio', e.target.value)}
                />
              </div>

              {/* Hourly rate & Society */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Hourly Rate (PKR) {modalMode === 'edit' && '(blank = unchanged)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="1200"
                    value={form.hourly_rate}
                    onChange={(e) => setField('hourly_rate', e.target.value)}
                  />
                </div>
                {modalMode === 'add' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Society</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={form.society_id}
                      onChange={(e) => setField('society_id', e.target.value)}
                    >
                      <option value="soc_pvc_isl">ParkView City · Islamabad</option>
                      <option value="soc_pvc_lhr">ParkView City · Lahore</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Skills */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Skills / Categories *</label>
                <div className="grid grid-cols-2 gap-2">
                  {allCats.map((cat) => {
                    const checked = form.category_ids.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors ${
                          checked
                            ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-brand-500"
                          checked={checked}
                          onChange={() => toggleCat(cat.id)}
                        />
                        {cat.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-brand-500"
                    checked={form.is_verified}
                    onChange={(e) => setField('is_verified', e.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-700">Mark as Verified</span>
                </label>
                {modalMode === 'edit' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-brand-500"
                      checked={form.is_available}
                      onChange={(e) => setField('is_available', e.target.checked)}
                    />
                    <span className="text-sm font-medium text-gray-700">Available</span>
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={handleSave}
                className="px-5 py-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : modalMode === 'add' ? 'Create Professional' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
