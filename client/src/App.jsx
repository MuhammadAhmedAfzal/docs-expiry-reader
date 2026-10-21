import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Documents from './pages/Documents.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import DocumentForm from './pages/DocumentForm.jsx';
import BulkImport from './pages/BulkImport.jsx';
import Notifications from './pages/Notifications.jsx';
import Tasks from './pages/Tasks.jsx';
import Users from './pages/Users.jsx';

function RequireAuth({ children, allow = true }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, isAdmin, can } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="documents" element={<Documents />} />
        <Route path="documents/new" element={<RequireAuth allow={can('createDocuments')}><DocumentForm /></RequireAuth>} />
        <Route path="documents/:id" element={<DocumentDetail />} />
        <Route path="documents/:id/edit" element={<DocumentForm />} />
        <Route path="import" element={<RequireAuth allow={can('importDocuments')}><BulkImport /></RequireAuth>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="users" element={<RequireAuth allow={isAdmin}><Users /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
