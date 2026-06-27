import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client.js';
import { fmtDate } from '../utils/format.js';
import Modal from '../components/Modal.jsx';
import PageHeader, { StatusBadge, Avatar } from '../components/PageHeader.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Staff() {
  const toast = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/users');
      setUsers(data);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(u) {
    try {
      await api.patch(`/auth/users/${u._id}/active`, { active: !u.active });
      load();
    } catch (e) { toast.error(apiError(e)); }
  }

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Team" title="Staff accounts" subtitle="Manage who can access the system and their role.">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="text-base leading-none">＋</span> Add staff
        </button>
      </PageHeader>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-paper-200 bg-paper-50">
              <tr>
                <th className="th">Member</th>
                <th className="th">Role</th>
                <th className="th">Joined</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-100">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}><td colSpan={5} className="td"><div className="h-6 animate-pulse rounded bg-paper-100" /></td></tr>
                ))
              ) : (
                users.map((u) => {
                  const self = u._id === user?._id;
                  return (
                    <tr key={u._id} className="transition hover:bg-paper-50/60">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div>
                            <div className="font-medium text-ink">{u.name} {self && <span className="text-xs text-ink-faint">(you)</span>}</div>
                            <div className="text-xs text-ink-faint">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="td"><StatusBadge kind={u.role}>{u.role === 'manager' ? 'Manager' : 'Front Desk'}</StatusBadge></td>
                      <td className="td text-ink-soft">{fmtDate(u.createdAt)}</td>
                      <td className="td"><StatusBadge kind={u.active ? 'active' : 'disabled'}>{u.active ? 'Active' : 'Disabled'}</StatusBadge></td>
                      <td className="td text-right">
                        {!self ? (
                          <button
                            className={u.active ? 'btn-ghost btn-sm text-rose-600 hover:bg-rose-50' : 'btn-secondary btn-sm'}
                            onClick={() => toggle(u)}
                          >
                            {u.active ? 'Disable' : 'Enable'}
                          </button>
                        ) : (
                          <span className="text-xs text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StaffForm open={showForm} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />
    </div>
  );
}

function StaffForm({ open, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'frontdesk' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm({ name: '', email: '', password: '', role: 'frontdesk' }); }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auth/users', form);
      toast.success('Staff account created');
      onDone();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add staff account"
      subtitle="They'll sign in with this email and password."
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="staff-form" disabled={saving}>{saving ? 'Saving…' : 'Create account'}</button>
        </>
      }
    >
      <form id="staff-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" className="input" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} placeholder="Min. 6 characters" />
        </div>
        <div>
          <label className="label">Role</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ v: 'frontdesk', l: 'Front Desk', d: 'Check-in, payments, stock' }, { v: 'manager', l: 'Manager', d: 'Full access' }].map((r) => (
              <button
                key={r.v}
                type="button"
                onClick={() => set('role', r.v)}
                className={`rounded-xl border p-3 text-left transition ${
                  form.role === r.v ? 'border-brand-500 bg-brand-50' : 'border-paper-300 hover:border-ink-faint'
                }`}
              >
                <div className="text-sm font-medium text-ink">{r.l}</div>
                <div className="mt-0.5 text-xs text-ink-faint">{r.d}</div>
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
