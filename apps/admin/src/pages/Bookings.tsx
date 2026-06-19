import { useEffect, useState, useMemo, Fragment } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import api from '../api/client';

interface Booking {
  id: string;
  status: string;
  category_name: string;
  resident_name: string;
  professional_name: string | null;
  address: string;
  problem_description: string;
  scheduled_at: string;
  created_at: string;
  quote_amount: number | null;
}

const ALL_STATUSES = ['pending_quote', 'quoted', 'confirmed', 'in_progress', 'completed', 'cancelled'];

const STATUS_BADGE: Record<string, string> = {
  pending_quote: 'bg-yellow-100 text-yellow-700',
  quoted:        'bg-blue-100 text-blue-700',
  confirmed:     'bg-violet-100 text-violet-700',
  in_progress:   'bg-orange-100 text-orange-700',
  completed:     'bg-green-100 text-green-700',
  cancelled:     'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending_quote: 'Pending Quote',
  quoted:        'Quoted',
  confirmed:     'Confirmed',
  in_progress:   'In Progress',
  completed:     'Completed',
  cancelled:     'Cancelled',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BookingsPage() {
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [expandedId, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/bookings')
      .then((r) => setBookings(r.data ?? []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bookings.filter((b) => {
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchSearch = !q
        || b.resident_name.toLowerCase().includes(q)
        || b.id.toLowerCase().includes(q)
        || b.category_name.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [bookings, search, statusFilter]);

  function toggleRow(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500 mt-1">{bookings.length} total bookings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Search by resident, ID or service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={statusFilter}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8" />
                {['Booking ID', 'Service', 'Resident', 'Professional', 'Status', 'Amount', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    No bookings match your filters
                  </td>
                </tr>
              ) : filtered.map((b) => (
                <Fragment key={b.id}>
                  <tr
                    className="hover:bg-gray-50/70 cursor-pointer"
                    onClick={() => toggleRow(b.id)}
                  >
                    <td className="pl-3 pr-0 py-3">
                      {expandedId === b.id
                        ? <ChevronDown size={15} className="text-gray-400" />
                        : <ChevronRight size={15} className="text-gray-400" />
                      }
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {b.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{b.category_name}</td>
                    <td className="px-4 py-3 text-gray-700">{b.resident_name}</td>
                    <td className="px-4 py-3 text-gray-500">{b.professional_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {b.quote_amount != null ? `PKR ${b.quote_amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(b.created_at)}</td>
                  </tr>

                  {expandedId === b.id && (
                    <tr className="bg-brand-50">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <DetailField label="Full ID"      value={b.id} mono />
                          <DetailField label="Address"      value={b.address} />
                          <DetailField label="Scheduled"    value={fmt(b.scheduled_at)} />
                          <DetailField label="Posted"       value={fmt(b.created_at)} />
                          <div className="col-span-2 md:col-span-4">
                            <DetailField label="Problem Description" value={b.problem_description} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <p className="text-xs text-gray-400 text-right">
          Showing {filtered.length} of {bookings.length} bookings
        </p>
      )}
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-gray-800 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}
