import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ExpiryBadge, TaskBadge, VersionBadge, daysLeftText, daysUntil, formatDate, formatDateTime } from '../components/status.jsx';

function StatCard({ label, value, tone, to }) {
  return (
    <Link to={to} className={`stat-card tone-${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </Link>
  );
}

function DocumentList({ docs, empty }) {
  if (!docs.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="doc-list">
      {docs.map((doc) => (
        <li key={doc._id}>
          <Link to={`/documents/${doc._id}`}>{doc.title}</Link>
          <span className="muted small">{doc.documentNumber}</span>
          <span className="spacer" />
          <span className="small">{formatDate(doc.expiryDate)}</span>
          <span className={`small days ${doc.expiryStatus}`}>{daysLeftText(daysUntil(doc.expiryDate))}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setData(data)).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="page-loading">Loading…</div>;
  const { counts } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Welcome, {user.name}</h1>
          <p className="muted">Overview of {can('viewAllDocuments') ? 'all documents' : 'documents assigned to you'}</p>
        </div>
        {can('createDocuments') && <Link className="btn btn-primary" to="/documents/new">+ Add document</Link>}
      </div>

      <div className="stat-grid">
        <StatCard label="Total documents" value={counts.total} tone="neutral" to="/documents" />
        <StatCard label="Expired" value={counts.expired} tone="danger" to="/documents?expiryStatus=expired" />
        <StatCard label="Expiring soon" value={counts.expiringSoon} tone="warning" to="/documents?expiryStatus=expiring_soon" />
        <StatCard label="Valid" value={counts.valid} tone="success" to="/documents?expiryStatus=valid" />
        <StatCard label="New" value={counts.new} tone="info" to="/documents?workflowStatus=new" />
        <StatCard label="In progress" value={counts.inProgress} tone="progress" to="/documents?workflowStatus=in_progress" />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <h2>Expired now</h2>
            <Link to="/documents?expiryStatus=expired" className="small">View all</Link>
          </div>
          <DocumentList docs={data.expired} empty="No expired documents." />
        </section>
        <section className="card">
          <div className="card-header">
            <h2>Expiring soon</h2>
            <Link to="/documents?expiryStatus=expiring_soon" className="small">View all</Link>
          </div>
          <DocumentList docs={data.expiringSoon} empty="Nothing expires in the coming days." />
        </section>
        <section className="card">
          <div className="card-header">
            <h2>Recently updated</h2>
            <Link to="/documents?sort=updated" className="small">View all</Link>
          </div>
          {data.recentlyUpdated.length === 0 ? (
            <p className="muted">No documents have been updated yet.</p>
          ) : (
            <ul className="doc-list">
              {data.recentlyUpdated.map((doc) => (
                <li key={doc._id}>
                  <Link to={`/documents/${doc._id}`}>{doc.title}</Link>
                  <VersionBadge version={doc.version} />
                  <span className="spacer" />
                  <span className="muted small">{formatDateTime(doc.updatedAt)}</span>
                  <ExpiryBadge status={doc.expiryStatus} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="card-header">
            <h2>My open tasks</h2>
            <Link to="/tasks" className="small">View all</Link>
          </div>
          {data.openTasks.length === 0 ? (
            <p className="muted">No open tasks.</p>
          ) : (
            <ul className="doc-list">
              {data.openTasks.map((task) => (
                <li key={task._id}>
                  <span>{task.title}</span>
                  {task.document && <Link className="small" to={`/documents/${task.document._id}`}>{task.document.title}</Link>}
                  <span className="spacer" />
                  <span className="muted small">Due {formatDate(task.dueDate)}</span>
                  <TaskBadge status={task.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
