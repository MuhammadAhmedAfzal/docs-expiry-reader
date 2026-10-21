import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api.js';
import { WorkflowBadge, daysLeftText, daysUntil, formatDate, formatDateTime } from '../components/status.jsx';

export default function Notifications() {
  const [state, setState] = useState('active');
  const [type, setType] = useState('');
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    api
      .get('/notifications', { params: { state, type: type || undefined } })
      .then(({ data }) => setNotifications(data.notifications))
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    setNotifications(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, type]);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`).catch(() => {});
    setNotifications((list) => list.map((n) => (n._id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    load();
  };

  const expired = notifications?.filter((n) => n.type === 'expired') ?? [];
  const expiring = notifications?.filter((n) => n.type === 'expiring_soon') ?? [];

  const renderItem = (n) => {
    const doc = n.document;
    const days = daysUntil(doc.expiryDate);
    return (
      <li key={n._id} className={`notification ${n.type} ${n.read || n.resolved ? 'read' : 'unread'}`}>
        <div className="notification-body">
          <div>
            <Link to={`/documents/${doc._id}`} className="strong">{doc.title}</Link>
            {doc.documentNumber && <span className="muted small"> · {doc.documentNumber}</span>}
          </div>
          {n.resolved ? (
            <div className="small">
              Renewed {formatDateTime(n.resolvedAt)}. Was {n.type === 'expired' ? 'expired' : 'expiring'} on {formatDate(n.expiryDate)}; new expiry date{' '}
              {formatDate(doc.expiryDate)}.
            </div>
          ) : (
            <div className="small">
              {n.type === 'expired' ? 'Expired' : 'Expires'} on {formatDate(doc.expiryDate)} · <strong>{daysLeftText(days)}</strong>
            </div>
          )}
          <div className="muted small">
            {doc.category || 'Uncategorised'} · Assigned to {doc.assignedTo?.map((u) => u.name).join(', ') || 'nobody'} ·{' '}
            <WorkflowBadge status={doc.workflowStatus} />
          </div>
        </div>
        <div className="notification-actions">
          {!n.resolved && (
            <Link className="btn btn-primary btn-sm" to={`/documents/${doc._id}/edit`}>Renew / upload new</Link>
          )}
          {!n.resolved && !n.read && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRead(n._id)}>Mark read</button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p className="muted">
            Alerts stay here until the document is renewed with a new file and expiry date.
          </p>
        </div>
        {state === 'active' && <button type="button" className="btn" onClick={markAllRead}>Mark all as read</button>}
      </div>

      <div className="tabs">
        <button type="button" className={state === 'active' ? 'active' : ''} onClick={() => setState('active')}>Active</button>
        <button type="button" className={state === 'resolved' ? 'active' : ''} onClick={() => setState('resolved')}>Resolved</button>
        <span className="spacer" />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Expired and expiring soon</option>
          <option value="expired">Expired only</option>
          <option value="expiring_soon">Expiring soon only</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!notifications ? (
        <div className="page-loading">Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="card empty-state">{state === 'active' ? 'All documents are up to date.' : 'No resolved notifications yet.'}</div>
      ) : state === 'resolved' ? (
        <ul className="notification-list card">{notifications.map(renderItem)}</ul>
      ) : (
        <>
          {expired.length > 0 && (
            <section>
              <h2 className="section-title danger">Expired ({expired.length})</h2>
              <ul className="notification-list card">{expired.map(renderItem)}</ul>
            </section>
          )}
          {expiring.length > 0 && (
            <section>
              <h2 className="section-title warning">Expiring soon ({expiring.length})</h2>
              <ul className="notification-list card">{expiring.map(renderItem)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
