import { useEffect, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import api from '../api/client';

interface Resident {
  id: string;
  name: string;
  phone: string;
  society_name: string | null;
  booking_count: number;
  created_at: string;
}

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading]    = useState(true);
  const [search, setSearch]      = useState('');

  useEffect(() => {
    api.get('/admin/residents')
      .then((r) => setResidents(r.data ?? []))
      .catch(() => setResidents([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return residents;
    return residents.filter(
      (r) => r.name.toLowerCase().includes(q) || r.phone.includes(q)
    );
  }, [residents, search]);

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Residents</h1>
        <p className="text-sm text-gray-500 mt-1">{residents.length} registered residents</p>
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
                {['Name', 'Phone', 'Society', 'Bookings', 'Joined'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    {search ? 'No residents match your search' : 'No residents registered yet'}
                  </td>
                </tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-semibold text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.phone}</td>
                  <td className="px-4 py-3 text-gray-500">{r.society_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      r.booking_count > 0
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {r.booking_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <p className="text-xs text-gray-400 text-right">
          Showing {filtered.length} of {residents.length} residents
        </p>
      )}
    </div>
  );
}
