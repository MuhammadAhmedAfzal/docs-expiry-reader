import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile, errorMessage } from '../api.js';
import { WORKFLOW_LABELS, formatDate } from '../components/status.jsx';

export default function BulkImport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (dryRun) => {
    setBusy(true);
    setError('');
    const body = new FormData();
    body.append('file', file);
    try {
      const { data } = await api.post('/import/documents', body, { params: { dryRun } });
      if (dryRun) setPreview(data);
      else {
        setResult(data);
        setPreview(null);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
  };

  return (
    <div>
      <div className="page-header">
        <h1>Bulk import</h1>
      </div>

      <section className="card">
        <h2>1. Prepare your CSV</h2>
        <p>
          Add one document per row. Only <strong>title</strong> is required. Dates can be <code>YYYY-MM-DD</code> or{' '}
          <code>DD/MM/YYYY</code>. <strong>assignedTo</strong> takes worker emails separated by <code>;</code>, and{' '}
          <strong>workflowStatus</strong> is one of <code>new</code>, <code>in_progress</code> or <code>completed</code>.
          Files can be attached to each document after the import.
        </p>
        <button type="button" className="btn" onClick={() => downloadFile('/import/template', 'documents-import-template.csv')}>
          Download CSV template
        </button>
      </section>

      <section className="card">
        <h2>2. Upload and check</h2>
        {result ? (
          <div>
            <div className="alert alert-success">
              Imported {result.imported} of {result.total} rows.
              {result.errorCount > 0 && ` ${result.errorCount} rows with errors were skipped.`}
            </div>
            <div className="actions">
              <Link className="btn btn-primary" to="/documents?sort=created">View documents</Link>
              <button type="button" className="btn" onClick={reset}>Import another file</button>
            </div>
          </div>
        ) : (
          <div className="import-controls">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                setPreview(null);
              }}
            />
            <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={() => send(true)}>
              {busy && !preview ? 'Checking…' : 'Check file'}
            </button>
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
      </section>

      {preview && (
        <section className="card">
          <div className="card-header">
            <h2>3. Review and import</h2>
            <button type="button" className="btn btn-primary" disabled={busy || preview.validCount === 0} onClick={() => send(false)}>
              {busy ? 'Importing…' : `Import ${preview.validCount} valid row${preview.validCount === 1 ? '' : 's'}`}
            </button>
          </div>
          <p>
            {preview.total} rows found: <strong className="text-success">{preview.validCount} ready</strong>
            {preview.errorCount > 0 && (
              <>, <strong className="text-danger">{preview.errorCount} with errors</strong> (they will be skipped; fix and re-upload to include them)</>
            )}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Title</th>
                  <th>Number</th>
                  <th>Category</th>
                  <th>Issue date</th>
                  <th>Expiry date</th>
                  <th>Status</th>
                  <th>Assigned to</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row} className={row.errors.length ? 'row-error' : ''}>
                    <td>{row.row}</td>
                    <td>{row.title || '—'}</td>
                    <td>{row.documentNumber || '—'}</td>
                    <td>{row.category || '—'}</td>
                    <td>{formatDate(row.issueDate)}</td>
                    <td>{formatDate(row.expiryDate)}</td>
                    <td>{WORKFLOW_LABELS[row.workflowStatus] || '—'}</td>
                    <td className="small">{row.assignedTo.join(', ') || '—'}</td>
                    <td className="small">
                      {row.errors.length ? <span className="text-danger">{row.errors.join('; ')}</span> : <span className="text-success">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
