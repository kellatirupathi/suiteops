import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client.js';
import { money } from '../utils/format.js';
import Modal from '../components/Modal.jsx';
import PageHeader, { StatusBadge } from '../components/PageHeader.jsx';
import { useToast } from '../components/Toast.jsx';

const STATUSES = ['available', 'occupied', 'maintenance'];

export default function Rooms() {
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRoom, setEditRoom] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/rooms');
      setRooms(data);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(room) {
    if (!confirm(`Delete room ${room.number}?`)) return;
    try {
      await api.delete(`/rooms/${room._id}`);
      toast.success('Room deleted');
      load();
    } catch (e) { toast.error(apiError(e)); }
  }

  const counts = rooms.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Property" title="Rooms" subtitle="Room inventory and rates.">
        <button className="btn-primary" onClick={() => { setEditRoom(null); setShowForm(true); }}>
          <span className="text-base leading-none">＋</span> Add room
        </button>
      </PageHeader>

      <div className="flex flex-wrap gap-2 text-sm">
        <Pill label="Available" n={counts.available || 0} kind="available" />
        <Pill label="Occupied" n={counts.occupied || 0} kind="occupied" />
        <Pill label="Maintenance" n={counts.maintenance || 0} kind="maintenance" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? [...Array(8)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-paper-200" />)
          : rooms.map((r) => (
              <div key={r._id} className="card flex flex-col p-5 transition hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="eyebrow">{r.type}</div>
                    <div className="text-2xl font-semibold leading-tight">Room {r.number}</div>
                  </div>
                  <StatusBadge kind={r.status}>{r.status[0].toUpperCase() + r.status.slice(1)}</StatusBadge>
                </div>
                <div className="mt-3 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{money(r.dailyRate)}</span> / night
                </div>
                <div className="mt-4 flex gap-2 border-t border-paper-100 pt-4">
                  <button className="btn-secondary btn-sm flex-1" onClick={() => { setEditRoom(r); setShowForm(true); }}>Edit</button>
                  <button className="btn-ghost btn-sm flex-1 text-rose-600 hover:bg-rose-50" onClick={() => remove(r)}>Delete</button>
                </div>
              </div>
            ))}
      </div>

      <RoomForm open={showForm} room={editRoom} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />
    </div>
  );
}

function Pill({ label, n, kind }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-paper-200 bg-white px-3 py-1.5">
      <StatusBadge kind={kind}>{n}</StatusBadge>
      <span className="text-ink-soft">{label}</span>
    </span>
  );
}

function RoomForm({ open, room, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ number: '', type: 'Standard', dailyRate: 0, status: 'available' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(room
      ? { number: room.number, type: room.type, dailyRate: room.dailyRate, status: room.status }
      : { number: '', type: 'Standard', dailyRate: 0, status: 'available' });
  }, [open, room]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, dailyRate: Number(form.dailyRate) };
      if (room) await api.patch(`/rooms/${room._id}`, payload);
      else await api.post('/rooms', payload);
      toast.success(room ? 'Room updated' : 'Room added');
      onDone();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={room ? 'Edit room' : 'Add room'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="room-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <form id="room-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Room number</label>
            <input className="input" value={form.number} onChange={(e) => set('number', e.target.value)} required />
          </div>
          <div>
            <label className="label">Type</label>
            <input className="input" value={form.type} onChange={(e) => set('type', e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Daily rate (₹)</label>
            <input type="number" min="0" className="input" value={form.dailyRate} onChange={(e) => set('dailyRate', e.target.value)} required />
          </div>
          {room && (
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
