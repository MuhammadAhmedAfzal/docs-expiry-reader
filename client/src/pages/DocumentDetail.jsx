import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api.js';
import FilePreview from '../components/FilePreview.jsx';
import {
  EXPIRY_LABELS,
  ExpiryBadge,
  VersionBadge,
  WORKFLOW_LABELS,
  WorkflowBadge,
  daysLeftText,
  formatDate,
  formatDateTime,
} from '../components/status.jsx';

const FIELD_LABELS = {
  title: 'Title',
  documentNumber: 'Document number',
  category: 'Category',
  description: 'Description',
  issueDate: 'Issue date',
  expiryDate: 'Expiry date',
  expiryStatus: 'Expiry status',
  workflowStatus: 'Workflow status',
  assignedTo: 'Assigned to',
  file: 'File',
};

const COMPARE_FIELDS = ['title', 'documentNumber', 'category', 'issueDate', 'expiryDate', 'expiryStatus', 'workflowStatus', 'assignedTo', 'description'];

function fieldText(field, value, userNames) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return '—';
  if (field === 'issueDate' || field === 'expiryDate') return formatDate(value);
  if (field === 'workflowStatus') return WORKFLOW_LABELS[value] || value;
  if (field === 'expiryStatus') return EXPIRY_LABELS[value] || value;
  if (field === 'assignedTo') return value.map((u) => u?.name || userNames[u] || 'Unknown user').join(', ');
  return String(value);
}

function CompareView({ doc, version, userNames, onClose }) {
  const old = version.snapshot;
  return (
    <section className="card compare">
      <div className="card-header">
        <h2>Old v{version.versionNumber} compared with current v{doc.version}</h2>
        <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
      </div>
      <table className="compare-table">
        <thead>
          <tr>
            <th>Field</th>
            <th className="old-col">Old (v{version.versionNumber})</th>
            <th className="new-col">Current (v{doc.version})</th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_FIELDS.map((field) => {
            const before = fieldText(field, old[field], userNames);
            const after = fieldText(field, doc[field], userNames);
            return (
              <tr key={field} className={before !== after ? 'changed' : ''}>
                <th>{FIELD_LABELS[field]}</th>
                <td className="old-col">{before}</td>
                <td className="new-col">{after}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="grid-2">
        <div>
          <h3>Old file</h3>
          <FilePreview documentId={doc._id} version={version.versionNumber} file={version.file} height={320} />
        </div>
        <div>
          <h3>Current file</h3>
          <FilePreview documentId={doc._id} file={doc.file} height={320} />
        </div>
      </div>
    </section>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [comparing, setComparing] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    Promise.all([api.get(`/documents/${id}`), api.get(`/documents/${id}/versions`)])
      .then(([docRes, versionRes]) => {
        setDoc(docRes.data.document);
        setVersions(versionRes.data.versions);
      })
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    load();
    setComparing(null);
    api
      .get('/users/options')
      .then(({ data }) => setUserNames(Object.fromEntries(data.users.map((u) => [u._id, u.name]))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const changeWorkflow = async (workflowStatus) => {
    try {
      await api.patch(`/documents/${id}`, { workflowStatus });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${doc.title}" and its whole version history? This cannot be undone.`)) return;
    try {
      await api.delete(`/documents/${id}`);
      navigate('/documents');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (error && !doc) return <div className="alert alert-error">{error}</div>;
  if (!doc) return <div className="page-loading">Loading…</div>;

  const needsRenewal = ['expired', 'expiring_soon'].includes(doc.expiryStatus);

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/documents" className="small">← Documents</Link>
          <h1>{doc.title}</h1>
          <div className="badge-row">
            <ExpiryBadge status={doc.expiryStatus} />
            <WorkflowBadge status={doc.workflowStatus} />
            <VersionBadge version={doc.version} />
            {doc.source === 'import' && <span className="badge">Imported</span>}
          </div>
        </div>
        <div className="actions">
          {doc.canEdit && (
            <select className="inline-select" value={doc.workflowStatus} onChange={(e) => changeWorkflow(e.target.value)} title="Workflow status">
              {Object.entries(WORKFLOW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
          {doc.canEdit && <Link className="btn btn-primary" to={`/documents/${id}/edit`}>{needsRenewal ? 'Renew / upload new' : 'Edit'}</Link>}
          {doc.canDelete && <button type="button" className="btn btn-danger" onClick={remove}>Delete</button>}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {needsRenewal && (
        <div className={`alert ${doc.expiryStatus === 'expired' ? 'alert-error' : 'alert-warning'}`}>
          {doc.expiryStatus === 'expired' ? 'This document has expired' : 'This document is expiring soon'} ({daysLeftText(doc.daysLeft)}).
          {doc.canEdit && ' Upload the renewed document with its new expiry date to clear the notification.'}
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <h2>Details</h2>
          <dl className="details">
            <dt>Document number</dt><dd>{doc.documentNumber || '—'}</dd>
            <dt>Category</dt><dd>{doc.category || '—'}</dd>
            <dt>Issue date</dt><dd>{formatDate(doc.issueDate)}</dd>
            <dt>Expiry date</dt>
            <dd>
              {formatDate(doc.expiryDate)} <span className={`small days ${doc.expiryStatus}`}>{daysLeftText(doc.daysLeft)}</span>
            </dd>
            <dt>Assigned to</dt><dd>{doc.assignedTo.map((u) => u.name).join(', ') || '—'}</dd>
            <dt>Created</dt><dd>{formatDateTime(doc.createdAt)} by {doc.createdBy?.name || '—'}</dd>
            <dt>Last updated</dt><dd>{formatDateTime(doc.updatedAt)} by {doc.updatedBy?.name || '—'}</dd>
            <dt>Description</dt><dd className="pre-wrap">{doc.description || '—'}</dd>
          </dl>
        </section>
        <section className="card">
          <h2>Current file (v{doc.version})</h2>
          <FilePreview documentId={doc._id} file={doc.file} />
        </section>
      </div>

      {comparing && <CompareView doc={doc} version={comparing} userNames={userNames} onClose={() => setComparing(null)} />}

      <section className="card">
        <h2>Version history</h2>
        {versions.length === 0 ? (
          <p className="muted">This is the original document. No updates have been made yet.</p>
        ) : (
          <ol className="timeline">
            <li className="timeline-current">
              <div className="timeline-title">
                <strong>v{doc.version} · Current</strong>
                <span className="muted small">{formatDateTime(doc.updatedAt)} by {doc.updatedBy?.name || '—'}</span>
              </div>
            </li>
            {versions.map((version) => (
              <li key={version._id}>
                <div className="timeline-title">
                  <strong>v{version.versionNumber} · Old</strong>
                  <span className="muted small">
                    replaced {formatDateTime(version.createdAt)} by {version.changedBy?.name || '—'}
                  </span>
                  <span className="spacer" />
                  <button type="button" className="btn btn-sm" onClick={() => setComparing(version)}>Compare with current</button>
                </div>
                {version.changeNote && <p className="change-note">“{version.changeNote}”</p>}
                <ul className="change-list">
                  {version.changes.map((change) => (
                    <li key={change.field}>
                      <span className="change-field">{FIELD_LABELS[change.field] || change.field}:</span>{' '}
                      <del>{fieldText(change.field, change.from, userNames)}</del> → <ins>{fieldText(change.field, change.to, userNames)}</ins>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
