import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ExpiryBadge, WORKFLOW_LABELS, daysLeftText, toInputDate } from '../components/status.jsx';

const EMPTY = {
  title: '',
  documentNumber: '',
  category: '',
  description: '',
  issueDate: '',
  expiryDate: '',
  workflowStatus: 'new',
  assignedTo: [],
};

export default function DocumentForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { can } = useAuth();
  const canAssign = can('manageTasks');

  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(null);
  const [file, setFile] = useState(null);
  const [changeNote, setChangeNote] = useState('');
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/documents/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
    if (canAssign) api.get('/users/options').then(({ data }) => setUsers(data.users)).catch(() => {});
  }, [canAssign]);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/documents/${id}`)
      .then(({ data }) => {
        const doc = data.document;
        setOriginal(doc);
        setForm({
          title: doc.title || '',
          documentNumber: doc.documentNumber || '',
          category: doc.category || '',
          description: doc.description || '',
          issueDate: toInputDate(doc.issueDate),
          expiryDate: toInputDate(doc.expiryDate),
          workflowStatus: doc.workflowStatus,
          assignedTo: doc.assignedTo.map((u) => u._id),
        });
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id, isEdit]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleAssignee = (userId) =>
    setForm((f) => ({
      ...f,
      assignedTo: f.assignedTo.includes(userId) ? f.assignedTo.filter((x) => x !== userId) : [...f.assignedTo, userId],
    }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = new FormData();
    for (const [key, value] of Object.entries(form)) {
      if (key === 'assignedTo') {
        if (canAssign) body.append('assignedTo', JSON.stringify(value));
      } else {
        body.append(key, value);
      }
    }
    if (file) body.append('file', file);
    if (isEdit && changeNote) body.append('changeNote', changeNote);

    try {
      const { data } = isEdit ? await api.patch(`/documents/${id}`, body) : await api.post('/documents', body);
      navigate(`/documents/${data.document._id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (isEdit && !original && !error) return <div className="page-loading">Loading…</div>;
  if (isEdit && original && !original.canEdit) {
    return <div className="alert alert-error">You can only edit documents assigned to you.</div>;
  }

  const needsRenewal = original && ['expired', 'expiring_soon'].includes(original.expiryStatus);

  return (
    <div>
      <div className="page-header">
        <h1>{isEdit ? `Edit: ${original?.title}` : 'Add document'}</h1>
        <Link className="btn" to={isEdit ? `/documents/${id}` : '/documents'}>Cancel</Link>
      </div>

      {needsRenewal && (
        <div className={`alert ${original.expiryStatus === 'expired' ? 'alert-error' : 'alert-warning'}`}>
          <ExpiryBadge status={original.expiryStatus} /> {daysLeftText(original.daysLeft)}. To renew it, upload the new
          document and set the new expiry date. The current version will be kept in the history.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-grid" onSubmit={submit}>
        <label className="span-2">
          Title *
          <input value={form.title} onChange={update('title')} required />
        </label>
        <label>
          Document number
          <input value={form.documentNumber} onChange={update('documentNumber')} />
        </label>
        <label>
          Category
          <input value={form.category} onChange={update('category')} list="category-options" placeholder="e.g. License, Passport" />
          <datalist id="category-options">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label>
          Issue date
          <input type="date" value={form.issueDate} onChange={update('issueDate')} />
        </label>
        <label>
          Expiry date
          <input type="date" value={form.expiryDate} onChange={update('expiryDate')} />
        </label>
        <label>
          Workflow status
          <select value={form.workflowStatus} onChange={update('workflowStatus')}>
            {Object.entries(WORKFLOW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          {isEdit ? 'Upload a new file (optional)' : 'File (image, PDF, Word, Excel)'}
          <input type="file" onChange={(e) => setFile(e.target.files[0] || null)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
          {isEdit && original?.file && <span className="muted small">Current file: {original.file.originalName}</span>}
        </label>
        <label className="span-2">
          Description
          <textarea rows={3} value={form.description} onChange={update('description')} />
        </label>

        {canAssign && (
          <fieldset className="span-2">
            <legend>Assign to</legend>
            <div className="checkbox-grid">
              {users.map((u) => (
                <label key={u._id} className="checkbox">
                  <input type="checkbox" checked={form.assignedTo.includes(u._id)} onChange={() => toggleAssignee(u._id)} />
                  {u.name} <span className="muted small">({u.role})</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {isEdit && (
          <label className="span-2">
            What changed? (saved in version history)
            <input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="e.g. Renewed for 2027" />
          </label>
        )}

        <div className="span-2 form-actions">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add document'}</button>
        </div>
      </form>
    </div>
  );
}
