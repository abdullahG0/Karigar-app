import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BookOpen, Users, Briefcase, Activity } from 'lucide-react';
import api from '../api/client';

interface Stats {
  total_bookings: number;
  active_bookings: number;
  total_professionals: number;
  total_residents: number;
}

interface CategoryStat {
  category_name: string;
  booking_count: number;
}

interface Booking {
  id: string;
  status: string;
  category_name: string;
  resident_name: string;
  professional_name: string | null;
  created_at: string;
  quote_amount: number | null;
}

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
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats]         = useState<Stats | null>(null);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/stats/categories'),
      api.get('/admin/bookings'),
    ])
      .then(([s, c, b]) => {
        setStats(s.data);
        setCategories(c.data ?? []);
        setBookings((b.data ?? []).slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your platform activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Bookings"          value={stats?.total_bookings ?? 0}     icon={BookOpen}  color="bg-brand-500" />
        <StatCard label="Active Bookings"         value={stats?.active_bookings ?? 0}    icon={Activity}  color="bg-orange-500" />
        <StatCard label="Professionals"           value={stats?.total_professionals ?? 0} icon={Briefcase} color="bg-violet-500" />
        <StatCard label="Registered Residents"    value={stats?.total_residents ?? 0}    icon={Users}     color="bg-sky-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Recent bookings table */}
        <div className="xl:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Recent Bookings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'Service', 'Resident', 'Professional', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No bookings yet
                    </td>
                  </tr>
                ) : bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {b.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{b.category_name}</td>
                    <td className="px-4 py-3 text-gray-600">{b.resident_name}</td>
                    <td className="px-4 py-3 text-gray-500">{b.professional_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category bar chart */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Bookings by Service</h2>
          {categories.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categories} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="category_name"
                  tick={{ fontSize: 11 }}
                  width={80}
                />
                <Tooltip
                  formatter={(v: number) => [v, 'Bookings']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="booking_count" fill="#1A6B4A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
