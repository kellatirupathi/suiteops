import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../api/client.js';
import { money } from '../utils/format.js';
import PageHeader, { StatusBadge, Avatar } from '../components/PageHeader.jsx';
import { useToast } from '../components/Toast.jsx';
import { PaymentModal } from './GuestDetail.jsx';

export default function Dues() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payGuest, setPayGuest] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/payments/dues');
      setRows(data);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const total = rows.reduce((s, r) => s + r.balanceDue, 0);
  const overdue = rows.filter((r) => r.overdue);
  const overdueTotal = overdue.reduce((s, r) => s + r.balanceDue, 0);

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Finance" title="Payments & dues" subtitle="Outstanding balances across all guests." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total outstanding" value={money(total)} accent="rose" />
        <SummaryCard label="Overdue amount" value={money(overdueTotal)} accent="brass" sub={`${overdue.length} guest(s)`} />
        <SummaryCard label="Guests with dues" value={rows.length} accent="ink" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-paper-200 bg-paper-50">
              <tr>
                <th className="th">Guest</th>
                <th className="th">Room</th>
                <th className="th text-right">Charges</th>
                <th className="th text-right">Paid</th>
                <th className="th text-right">Balance</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-100">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="td"><div className="h-6 animate-pulse rounded bg-paper-100" /></td></tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="td py-12 text-center text-brand-500">All guests are settled up.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="transition hover:bg-paper-50/60">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} />
                        <div>
                          <div className="font-medium text-ink">{r.name}</div>
                          <div className="text-xs text-ink-faint">{r.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td font-medium text-ink">{r.roomNumber}</td>
                    <td className="td text-right">{money(r.totalCharges)}</td>
                    <td className="td text-right text-brand-500">{money(r.paid)}</td>
                    <td className="td text-right font-semibold text-rose-600">{money(r.balanceDue)}</td>
                    <td className="td"><StatusBadge kind={r.overdue ? 'overdue' : 'outstanding'}>{r.overdue ? 'Overdue' : 'Outstanding'}</StatusBadge></td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/guests/${r._id}`} className="btn-secondary btn-sm">View</Link>
                        <button className="btn-primary btn-sm" onClick={() => setPayGuest(r)}>Record payment</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentModal
        open={!!payGuest}
        guest={payGuest ? { _id: payGuest._id, name: payGuest.name, finance: payGuest } : null}
        onClose={() => setPayGuest(null)}
        onDone={() => { setPayGuest(null); load(); }}
      />
    </div>
  );
}

function SummaryCard({ label, value, sub, accent = 'ink' }) {
  const colors = { ink: 'text-ink', rose: 'text-rose-600', brass: 'text-amber-700' };
  return (
    <div className="card p-5">
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${colors[accent]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-faint">{sub}</div>}
    </div>
  );
}
