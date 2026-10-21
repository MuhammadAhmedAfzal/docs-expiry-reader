import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  EXPIRY_LABELS,
  ExpiryBadge,
  VersionBadge,
  WORKFLOW_LABELS,
  daysLeftText,
  formatDate,
} from '../components/status.jsx';

const FILTER_KEYS = ['search', 'expiryStatus', 'workflowStatus', 'category', 'sort', 'page'];

export default function Documents() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(params.get('search') || '');

  const query = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || '']).filter(([, v]) => v));

  const load = () =>
    api
      .get('/documents', { params: query })
      .then(({ data }) => setResult(data))
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    api.get('/documents/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  }, []);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const changeWorkflow = async (doc, workflowStatus) => {
    try {
      await api.patch(`/documents/${doc._id}`, { workflowStatus });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Documents</h1>
        <div className="actions">
          {can('importDocuments') && <Link className="btn" to="/import">Bulk import</Link>}
          {can('createDocuments') && <Link className="btn btn-primary" to="/documents/new">+ Add document</Link>}
        </div>
      </div>

      <form
        className="filters card"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter('search', search.trim());
        }}
      >
        <input placeholder="Search title, number, category…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={query.expiryStatus || ''} onChange={(e) => setFilter('expiryStatus', e.target.value)}>
          <option value="">Any expiry status</option>
          {Object.entries(EXPIRY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={query.workflowStatus || ''} onChange={(e) => setFilter('workflowStatus', e.target.value)}>
          <option value="">Any workflow status</option>
          {Object.entries(WORKFLOW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={query.category || ''} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={query.sort || 'expiryDate'} onChange={(e) => setFilter('sort', e.target.value)}>
          <option value="expiryDate">Sort: expiry date</option>
          <option value="updated">Sort: recently updated</option>
          <option value="created">Sort: recently added</option>
          <option value="title">Sort: title</option>
        </select>
        <button className="btn">Search</button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}
      {!result ? (
        <div className="page-loading">Loading…</div>
      ) : result.documents.length === 0 ? (
        <div className="card empty-state">No documents match these filters.</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Expiry date</th>
                <th>Expiry status</th>
                <th>Workflow</th>
                <th>Version</th>
                <th>Assigned to</th>
              </tr>
            </thead>
            <tbody>
              {result.documents.map((doc) => (
                <tr key={doc._id} className={`row-${doc.expiryStatus}`}>
                  <td>
                    <Link to={`/documents/${doc._id}`} className="strong">{doc.title}</Link>
                    <div className="muted small">{doc.documentNumber}</div>
                  </td>
                  <td>{doc.category || '—'}</td>
                  <td>
                    {formatDate(doc.expiryDate)}
                    <div className={`small days ${doc.expiryStatus}`}>{daysLeftText(doc.daysLeft)}</div>
                  </td>
                  <td><ExpiryBadge status={doc.expiryStatus} /></td>
                  <td>
                    {doc.canEdit ? (
                      <select
                        className={`inline-select workflow-${doc.workflowStatus}`}
                        value={doc.workflowStatus}
                        onChange={(e) => changeWorkflow(doc, e.target.value)}
                      >
                        {Object.entries(WORKFLOW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    ) : (
                      WORKFLOW_LABELS[doc.workflowStatus]
                    )}
                  </td>
                  <td><VersionBadge version={doc.version} /></td>
                  <td className="small">{doc.assignedTo.map((u) => u.name).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span className="muted small">{result.total} documents</span>
            <button className="btn btn-sm" disabled={result.page <= 1} onClick={() => setFilter('page', String(result.page - 1))}>Previous</button>
            <span className="small">Page {result.page} of {result.pages}</span>
            <button className="btn btn-sm" disabled={result.page >= result.pages} onClick={() => setFilter('page', String(result.page + 1))}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
