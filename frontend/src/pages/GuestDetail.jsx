import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { apiError } from '../api/client.js';
import { money, fmtDate, toInputDate } from '../utils/format.js';
import { generateInvoice } from '../utils/invoice.js';
import Modal from '../components/Modal.jsx';
import { StatusBadge, Avatar } from '../components/PageHeader.jsx';
import { useToast } from '../components/Toast.jsx';

export default function GuestDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [guest, setGuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);

  async function load() {
    try {
      const { data } = await api.get(`/guests/${id}`);
      setGuest(data);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <div className="text-ink-faint">Loading…</div>;
  if (!guest) return <div className="text-ink-faint">Guest not found.</div>;
  const f = guest.finance || {};
  const payments = guest.payments || [];

  return (
    <div className="space-y-7">
      <Link to="/guests" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-faint hover:text-ink">
        ← Back to register
      </Link>

      {/* hero */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={guest.name} size="md" />
          <div>
            <h1 className="text-3xl font-semibold leading-tight">{guest.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge kind={guest.status}>{guest.status === 'checked-in' ? 'In-house' : 'Checked out'}</StatusBadge>
              {f.overdue && <StatusBadge kind="overdue">Overdue</StatusBadge>}
              <span className="text-sm text-ink-faint">Room {guest.roomNumber} · {guest.phone}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => generateInvoice(guest, f, payments)}>
            Download invoice
          </button>
          <button className="btn-primary" onClick={() => setPayOpen(true)}>Record payment</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* details */}
        <div className="card p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold">Stay details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row k="ID number" v={guest.idNumber} />
            <Row k="Daily rate" v={`${money(guest.dailyRate)}/night`} />
            <Row k="Check-in" v={fmtDate(guest.checkInDate)} />
            <Row k="Expected out" v={fmtDate(guest.expectedCheckOutDate)} />
            <Row k="Actual out" v={fmtDate(guest.actualCheckOutDate)} />
            <Row k="Nights billed" v={f.nights} />
          </dl>
        </div>

        {/* financials */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Account</h2>
            {f.fullyPaid
              ? <StatusBadge kind="paid">Fully paid</StatusBadge>
              : <StatusBadge kind="outstanding">Outstanding</StatusBadge>}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Total charges" value={money(f.totalCharges)} />
            <Stat label="Paid" value={money(f.paid)} accent="teal" />
            <Stat label="Balance due" value={money(f.balanceDue)} accent={f.balanceDue > 0 ? 'rose' : 'teal'} />
          </div>

          <h3 className="mb-1 mt-7 text-sm font-semibold text-ink-soft">Payment history</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-paper-200">
                  <th className="th px-0">Date</th>
                  <th className="th">Mode</th>
                  <th className="th">Reference</th>
                  <th className="th px-0 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-100">
                {payments.length === 0 ? (
                  <tr><td colSpan={4} className="td px-0 py-6 text-center text-ink-faint">No payments recorded yet.</td></tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p._id}>
                      <td className="td px-0">{fmtDate(p.date)}</td>
                      <td className="td"><span className="badge bg-paper-100 text-ink-soft uppercase">{p.mode}</span></td>
                      <td className="td text-ink-faint">{p.reference || '—'}</td>
                      <td className="td px-0 text-right font-semibold text-ink">{money(p.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PaymentModal
        open={payOpen}
        guest={guest}
        onClose={() => setPayOpen(false)}
        onDone={() => { setPayOpen(false); load(); }}
      />
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-faint">{k}</dt>
      <dd className="font-medium text-ink">{v ?? '—'}</dd>
    </div>
  );
}

function Stat({ label, value, accent = 'ink' }) {
  const colors = { ink: 'text-ink', teal: 'text-brand-500', rose: 'text-rose-600' };
  return (
    <div className="rounded-xl border border-paper-200 bg-paper-50 p-4">
      <div className="text-[0.72rem] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${colors[accent]}`}>{value}</div>
    </div>
  );
}

export function PaymentModal({ open, guest, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ amount: '', mode: 'cash', reference: '', date: toInputDate() });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ amount: '', mode: 'cash', reference: '', date: toInputDate() });
  }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const balance = guest?.finance?.balanceDue;

  async function submit(e) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount greater than 0');
      return;
    }
    if (balance != null && amt > balance + 0.001) {
      toast.error(`Amount exceeds balance due (${money(balance)})`);
      return;
    }
    setSaving(true);
    try {
      await api.post('/payments', { guestId: guest._id, ...form, amount: amt });
      toast.success('Payment recorded');
      onDone();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  }

  const modes = [
    { v: 'cash', l: 'Cash' },
    { v: 'card', l: 'Card' },
    { v: 'upi', l: 'UPI' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      subtitle={guest?.name}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="pay-form" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</button>
        </>
      }
    >
      {balance != null && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-paper-50 px-4 py-3 text-sm">
          <span className="text-ink-faint">Balance due</span>
          <span className="font-semibold text-rose-600">{money(balance)}</span>
        </div>
      )}
      <form id="pay-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Amount</label>
          <div className="flex items-center gap-2">
            <input type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={(e) => set('amount', e.target.value)} required placeholder="0.00" />
            {balance > 0 && (
              <button type="button" className="btn-secondary btn-sm whitespace-nowrap" onClick={() => set('amount', String(balance))}>
                Full
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="label">Payment mode</label>
          <div className="inline-flex w-full rounded-lg border border-paper-300 bg-white p-0.5">
            {modes.map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => set('mode', m.v)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  form.mode === m.v ? 'bg-brand-500 text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {m.l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input" value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </form>
    </Modal>
  );
}
