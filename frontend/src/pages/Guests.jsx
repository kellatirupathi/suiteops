import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../api/client.js';
import { money, fmtDate, toInputDate } from '../utils/format.js';
import Modal from '../components/Modal.jsx';
import PageHeader, { StatusBadge, Avatar } from '../components/PageHeader.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Guests() {
  const toast = useToast();
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('checked-in');
  const [showForm, setShowForm] = useState(false);
  const [checkoutGuest, setCheckoutGuest] = useState(null);
  const reqId = useRef(0);

  async function load() {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (status) params.status = status;
      const { data } = await api.get('/guests', { params });
      // Ignore stale responses that resolved after a newer request was fired.
      if (id !== reqId.current) return;
      setGuests(data);
    } catch (e) {
      if (id === reqId.current) toast.error(apiError(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }

  async function loadRooms() {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data);
    } catch { /* non-fatal */ }
  }

  useEffect(() => { loadRooms(); }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search, status]);

  const availableRooms = rooms.filter((r) => r.status === 'available');
  const inHouse = guests.filter((g) => g.status === 'checked-in').length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Front desk"
        title="Guest register"
        subtitle="Search, check in and check out guests."
      >
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="text-base leading-none">＋</span> Check in
        </button>
      </PageHeader>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>
          </span>
          <input
            className="input pl-9"
            placeholder="Name, room, ID or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { v: 'checked-in', l: 'In-house' },
            { v: 'checked-out', l: 'Past' },
            { v: '', l: 'All' },
          ]}
        />
        <span className="ml-auto text-sm text-ink-faint">
          {loading ? '…' : `${guests.length} shown`}{status === 'checked-in' ? '' : ` · ${inHouse} in-house`}
        </span>
      </div>

      {/* list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-paper-200 bg-paper-50">
              <tr>
                <th className="th">Guest</th>
                <th className="th">Room</th>
                <th className="th">Stay</th>
                <th className="th text-right">Balance</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={6} className="td"><div className="h-6 animate-pulse rounded bg-paper-100" /></td></tr>
                ))
              ) : guests.length === 0 ? (
                <tr><td colSpan={6} className="td py-12 text-center text-ink-faint">No guests match your filters.</td></tr>
              ) : (
                guests.map((g) => (
                  <tr key={g._id} className="transition hover:bg-paper-50/60">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar name={g.name} />
                        <div>
                          <div className="font-medium text-ink">{g.name}</div>
                          <div className="text-xs text-ink-faint">{g.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td font-medium text-ink">{g.roomNumber}</td>
                    <td className="td">
                      <div className="text-ink-soft">{fmtDate(g.checkInDate)}</div>
                      <div className="text-xs text-ink-faint">→ {fmtDate(g.expectedCheckOutDate)}</div>
                    </td>
                    <td className="td text-right">
                      <span className={g.finance?.balanceDue > 0 ? 'font-semibold text-rose-600' : 'font-medium text-brand-500'}>
                        {money(g.finance?.balanceDue)}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge kind={g.status}>{g.status === 'checked-in' ? 'In-house' : 'Checked out'}</StatusBadge>
                        {g.finance?.overdue && <StatusBadge kind="overdue">Overdue</StatusBadge>}
                      </div>
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/guests/${g._id}`} className="btn-secondary btn-sm">View</Link>
                        {g.status === 'checked-in' && (
                          <button className="btn-primary btn-sm" onClick={() => setCheckoutGuest(g)}>Check out</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CheckInForm
        open={showForm}
        onClose={() => setShowForm(false)}
        rooms={availableRooms}
        onDone={() => { setShowForm(false); load(); loadRooms(); }}
      />
      <CheckOutModal
        guest={checkoutGuest}
        onClose={() => setCheckoutGuest(null)}
        onDone={() => { setCheckoutGuest(null); load(); loadRooms(); }}
      />
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-paper-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            value === o.v ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function CheckInForm({ open, onClose, rooms, onDone }) {
  const toast = useToast();
  const empty = {
    name: '', idNumber: '', phone: '', roomId: '',
    checkInDate: toInputDate(),
    expectedCheckOutDate: toInputDate(new Date(Date.now() + 86400000)),
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(empty); /* eslint-disable-next-line */ }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/guests', form);
      toast.success('Guest checked in');
      onDone();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  }

  const selectedRoom = rooms.find((r) => r._id === form.roomId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Check in guest"
      subtitle="Record arrival details and assign a room."
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="checkin-form" disabled={saving}>
            {saving ? 'Saving…' : 'Confirm check-in'}
          </button>
        </>
      }
    >
      <form id="checkin-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Guest name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">ID number</label>
            <input className="input" value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Room</label>
          <select className="input" value={form.roomId} onChange={(e) => set('roomId', e.target.value)} required>
            <option value="">Select an available room…</option>
            {rooms.map((r) => (
              <option key={r._id} value={r._id}>Room {r.number} · {r.type} · {money(r.dailyRate)}/night</option>
            ))}
          </select>
          {rooms.length === 0 && <p className="mt-1 text-xs text-amber-700">No rooms currently available.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Check-in date</label>
            <input type="date" className="input" value={form.checkInDate} onChange={(e) => set('checkInDate', e.target.value)} required />
          </div>
          <div>
            <label className="label">Expected check-out</label>
            <input type="date" className="input" value={form.expectedCheckOutDate} onChange={(e) => set('expectedCheckOutDate', e.target.value)} required />
          </div>
        </div>
        {selectedRoom && (
          <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm">
            <span className="text-brand-600">Room {selectedRoom.number} · {selectedRoom.type}</span>
            <span className="font-semibold text-brand-600">{money(selectedRoom.dailyRate)}/night</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

function CheckOutModal({ guest, onClose, onDone }) {
  const toast = useToast();
  const [date, setDate] = useState(toInputDate());
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (guest) setDate(toInputDate()); }, [guest]);
  if (!guest) return null;

  async function submit() {
    setSaving(true);
    try {
      await api.post(`/guests/${guest._id}/checkout`, { actualCheckOutDate: date });
      toast.success(`${guest.name} checked out`);
      onDone();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!guest}
      onClose={onClose}
      title={`Check out · ${guest.name}`}
      subtitle={`Room ${guest.roomNumber}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Processing…' : 'Confirm check-out'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-paper-50 px-4 py-3 text-sm">
          <span className="text-ink-faint">Current balance</span>
          <span className={`font-semibold ${guest.finance?.balanceDue > 0 ? 'text-rose-600' : 'text-brand-500'}`}>
            {money(guest.finance?.balanceDue)}
          </span>
        </div>
        {guest.finance?.balanceDue > 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            This guest still has an outstanding balance. You can still check them out, but the dues will remain on record.
          </div>
        )}
        <div>
          <label className="label">Actual check-out date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
