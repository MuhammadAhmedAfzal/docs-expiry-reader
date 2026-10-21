import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ExpiryBadge, TASK_LABELS, TaskBadge, formatDate } from '../components/status.jsx';

const EMPTY_TASK = { title: '', description: '', assignedTo: '', document: '', dueDate: '' };

export default function Tasks() {
  const { user, isAdmin, can } = useAuth();
  const isManager = can('manageTasks');
  const [tasks, setTasks] = useState(null);
  const [statusFilter, setStatusFilter] = useState('todo,in_progress');
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState(EMPTY_TASK);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    api
      .get('/tasks', { params: { status: statusFilter || undefined } })
      .then(({ data }) => setTasks(data.tasks))
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!isManager) return;
    api.get('/users/options').then(({ data }) => setUsers(data.users)).catch(() => {});
    api.get('/documents', { params: { limit: 100, sort: 'title' } }).then(({ data }) => setDocuments(data.documents)).catch(() => {});
  }, [isManager]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const create = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/tasks', form);
      setForm(EMPTY_TASK);
      setShowForm(false);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const changeStatus = async (task, status) => {
    try {
      await api.patch(`/tasks/${task._id}`, { status });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await api.delete(`/tasks/${task._id}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="muted">{isManager ? 'Assign work on documents to workers.' : 'Tasks assigned to you.'}</p>
        </div>
        {isManager && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Close' : '+ New task'}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <form className="card form-grid" onSubmit={create}>
          <label className="span-2">
            Title *
            <input value={form.title} onChange={update('title')} required placeholder="e.g. Renew the trade license" />
          </label>
          <label>
            Assign to *
            <select value={form.assignedTo} onChange={update('assignedTo')} required>
              <option value="">Choose a person</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
            </select>
          </label>
          <label>
            Document
            <select value={form.document} onChange={update('document')}>
              <option value="">None</option>
              {documents.map((d) => <option key={d._id} value={d._id}>{d.title}{d.documentNumber ? ` (${d.documentNumber})` : ''}</option>)}
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={form.dueDate} onChange={update('dueDate')} />
          </label>
          <label className="span-2">
            Description
            <textarea rows={2} value={form.description} onChange={update('description')} />
          </label>
          <p className="span-2 muted small">Linking a document gives the assignee access to view and edit it.</p>
          <div className="span-2 form-actions"><button className="btn btn-primary">Create task</button></div>
        </form>
      )}

      <div className="tabs">
        {[
          ['todo,in_progress', 'Open'],
          ['done', 'Done'],
          ['', 'All'],
        ].map(([value, label]) => (
          <button key={label} type="button" className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>
            {label}
          </button>
        ))}
      </div>

      {!tasks ? (
        <div className="page-loading">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="card empty-state">No tasks here.</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Document</th>
                <th>Assigned to</th>
                <th>Due</th>
                <th>Status</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const canChange = isManager || task.assignedTo?._id === user._id;
                return (
                  <tr key={task._id}>
                    <td>
                      <div className="strong">{task.title}</div>
                      {task.description && <div className="muted small">{task.description}</div>}
                      <div className="muted small">by {task.assignedBy?.name || '—'}</div>
                    </td>
                    <td>
                      {task.document ? (
                        <>
                          <Link to={`/documents/${task.document._id}`}>{task.document.title}</Link>{' '}
                          <ExpiryBadge status={task.document.expiryStatus} />
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{task.assignedTo?.name || '—'}</td>
                    <td>{formatDate(task.dueDate)}</td>
                    <td>
                      {canChange ? (
                        <select className={`inline-select task-${task.status}`} value={task.status} onChange={(e) => changeStatus(task, e.target.value)}>
                          {Object.entries(TASK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      ) : (
                        <TaskBadge status={task.status} />
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => remove(task)}>Delete</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
