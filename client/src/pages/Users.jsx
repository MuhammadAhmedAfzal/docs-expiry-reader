import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

const EMPTY_USER = { name: '', email: '', password: '', role: 'worker' };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [permissionLabels, setPermissionLabels] = useState({});
  const [form, setForm] = useState(EMPTY_USER);
  const [newPermissions, setNewPermissions] = useState({ createDocuments: true });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () =>
    api
      .get('/users')
      .then(({ data }) => setUsers(data.users))
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    load();
    api.get('/users/permissions').then(({ data }) => setPermissionLabels(data.permissions)).catch(() => {});
  }, []);

  const run = async (action, successMessage) => {
    setError('');
    setMessage('');
    try {
      await action();
      if (successMessage) setMessage(successMessage);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const create = (event) => {
    event.preventDefault();
    run(async () => {
      await api.post('/users', { ...form, permissions: newPermissions });
      setForm(EMPTY_USER);
      setNewPermissions({ createDocuments: true });
    }, `Created ${form.role} ${form.name}`);
  };

  const patch = (user, body, msg) => run(() => api.patch(`/users/${user._id}`, body), msg);

  const resetPassword = (user) => {
    const password = window.prompt(`New password for ${user.name} (at least 6 characters):`);
    if (password) patch(user, { password }, `Password reset for ${user.name}`);
  };

  const remove = (user) => {
    if (window.confirm(`Delete ${user.name}? Their tasks are deleted and they are removed from documents.`)) {
      run(() => api.delete(`/users/${user._id}`), `Deleted ${user.name}`);
    }
  };

  const permissionKeys = Object.keys(permissionLabels);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users &amp; permissions</h1>
          <p className="muted">Admins can do everything. Workers get the permissions you tick. Only admins can delete documents.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form className="card form-grid" onSubmit={create}>
        <h2 className="span-2">Create user</h2>
        <label>
          Name *
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Email *
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label>
          Password *
          <input type="text" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="worker">Worker</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {form.role === 'worker' && (
          <fieldset className="span-2">
            <legend>Permissions</legend>
            <div className="checkbox-grid">
              {permissionKeys.map((key) => (
                <label key={key} className="checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(newPermissions[key])}
                    onChange={(e) => setNewPermissions({ ...newPermissions, [key]: e.target.checked })}
                  />
                  {permissionLabels[key]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="span-2 form-actions"><button className="btn btn-primary">Create user</button></div>
      </form>

      {!users ? (
        <div className="page-loading">Loading…</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                {permissionKeys.map((key) => <th key={key} className="perm-col" title={permissionLabels[key]}>{permissionLabels[key]}</th>)}
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u._id === me._id;
                return (
                  <tr key={u._id} className={u.active ? '' : 'row-disabled'}>
                    <td>
                      <div className="strong">{u.name}{isMe && ' (you)'}</div>
                      <div className="muted small">{u.email}</div>
                    </td>
                    <td>
                      <select value={u.role} disabled={isMe} onChange={(e) => patch(u, { role: e.target.value }, `${u.name} is now ${e.target.value}`)}>
                        <option value="worker">Worker</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    {permissionKeys.map((key) => (
                      <td key={key} className="perm-col">
                        {u.role === 'admin' ? (
                          <span className="muted small">All</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={Boolean(u.permissions?.[key])}
                            onChange={(e) => patch(u, { permissions: { [key]: e.target.checked } })}
                          />
                        )}
                      </td>
                    ))}
                    <td>{u.active ? 'Active' : 'Disabled'}</td>
                    <td className="row-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => resetPassword(u)}>Reset password</button>
                      {!isMe && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(u, { active: !u.active }, `${u.name} ${u.active ? 'disabled' : 'enabled'}`)}>
                          {u.active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                      {!isMe && <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => remove(u)}>Delete</button>}
                    </td>
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
