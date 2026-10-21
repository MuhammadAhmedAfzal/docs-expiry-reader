import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Layout() {
  const { user, isAdmin, can, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const load = () => api.get('/notifications/summary').then(({ data }) => setSummary(data)).catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [location.pathname]);

  const alertCount = summary ? summary.expired + summary.expiringSoon : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">DocTrack</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/documents">Documents</NavLink>
          <NavLink to="/notifications">
            Notifications
            {alertCount > 0 && <span className={`nav-badge ${summary.expired ? 'danger' : 'warning'}`}>{alertCount}</span>}
          </NavLink>
          <NavLink to="/tasks">Tasks</NavLink>
          {can('importDocuments') && <NavLink to="/import">Bulk import</NavLink>}
          {isAdmin && <NavLink to="/users">Users &amp; permissions</NavLink>}
        </nav>
        <div className="sidebar-user">
          <div className="user-name">{user.name}</div>
          <div className="muted small">{user.email}</div>
          <span className={`role-pill ${user.role}`}>{user.role}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
        <div className="credit">Built by Muhammad Ahmed Afzal</div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
