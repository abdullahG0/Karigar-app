import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Briefcase, Users, LogOut } from 'lucide-react';

import DashboardPage    from './pages/Dashboard';
import BookingsPage     from './pages/Bookings';
import ProfessionalsPage from './pages/Professionals';
import ResidentsPage    from './pages/Residents';
import LoginPage        from './pages/Login';

const NAV = [
  { to: 'dashboard',     icon: LayoutDashboard, label: 'Dashboard'    },
  { to: 'bookings',      icon: BookOpen,        label: 'Bookings'     },
  { to: 'professionals', icon: Briefcase,       label: 'Professionals' },
  { to: 'residents',     icon: Users,           label: 'Residents'    },
];

function Sidebar() {
  const navigate  = useNavigate();
  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') ?? '{}'); } catch { return {}; }
  })();

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  return (
    <aside className="w-60 min-h-screen bg-brand-700 text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-brand-800">
        <div className="text-xs font-semibold text-brand-300 uppercase tracking-widest mb-0.5">
          Admin Panel
        </div>
        <div className="text-lg font-bold leading-tight">Karigar</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={`/${to}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500 text-white'
                  : 'text-brand-100 hover:bg-brand-800 hover:text-white'
              }`
            }
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: admin info + logout */}
      <div className="border-t border-brand-800">
        {adminUser.name && (
          <div className="px-6 py-3">
            <div className="text-xs text-brand-300">Signed in as</div>
            <div className="text-sm font-semibold text-white truncate">{adminUser.name}</div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-6 py-3.5 text-sm text-brand-100 hover:bg-brand-800 hover:text-white transition-colors"
        >
          <LogOut size={17} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

function ProtectedLayout() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto min-w-0">
        <Routes>
          <Route path="dashboard"     element={<DashboardPage />}    />
          <Route path="bookings"      element={<BookingsPage />}     />
          <Route path="professionals" element={<ProfessionalsPage />} />
          <Route path="residents"     element={<ResidentsPage />}    />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*"     element={<ProtectedLayout />} />
    </Routes>
  );
}
