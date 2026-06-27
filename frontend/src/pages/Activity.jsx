import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client.js';
import { fmtDateTime } from '../utils/format.js';
import PageHeader, { Avatar } from '../components/PageHeader.jsx';
import { useToast } from '../components/Toast.jsx';

const ACTIONS = {
  CHECK_IN: { label: 'Check-in', dot: 'bg-brand-500' },
  CHECK_OUT: { label: 'Check-out', dot: 'bg-ink-faint' },
  PAYMENT: { label: 'Payment', dot: 'bg-amber-500' },
  GUEST_UPDATE: { label: 'Guest update', dot: 'bg-paper-300' },
  INVENTORY_CREATE: { label: 'Inventory', dot: 'bg-amber-500' },
  INVENTORY_UPDATE: { label: 'Inventory', dot: 'bg-amber-500' },
  INVENTORY_ADJUST: { label: 'Inventory', dot: 'bg-amber-500' },
  INVENTORY_DELETE: { label: 'Inventory', dot: 'bg-rose-500' },
  ROOM_CREATE: { label: 'Room', dot: 'bg-violet-500' },
  ROOM_UPDATE: { label: 'Room', dot: 'bg-violet-500' },
  ROOM_DELETE: { label: 'Room', dot: 'bg-rose-500' },
};

export default function Activity() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/activity', { params: action ? { action } : {} });
      setLogs(data);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [action]);

  // group by date
  const groups = logs.reduce((acc, l) => {
    const key = new Date(l.createdAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    (acc[key] = acc[key] || []).push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Accountability" title="Activity log" subtitle="A timestamped audit trail of every staff action.">
        <select className="input max-w-[200px]" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {Object.keys(ACTIONS).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </PageHeader>

      {loading ? (
        <div className="card p-6"><div className="h-40 animate-pulse rounded bg-paper-100" /></div>
      ) : logs.length === 0 ? (
        <div className="card p-12 text-center text-ink-faint">No activity recorded yet.</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([date, items]) => (
            <div key={date} className="card overflow-hidden">
              <div className="border-b border-paper-200 bg-paper-50 px-5 py-3">
                <span className="text-sm font-semibold text-ink">{date}</span>
                <span className="ml-2 text-xs text-ink-faint">{items.length} action{items.length > 1 ? 's' : ''}</span>
              </div>
              <ul className="divide-y divide-paper-100">
                {items.map((l) => {
                  const meta = ACTIONS[l.action] || { label: l.action, dot: 'bg-paper-300' };
                  return (
                    <li key={l._id} className="flex items-start gap-4 px-5 py-3.5">
                      <div className="mt-1 flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                      </div>
                      <Avatar name={l.userName || l.user?.name || 'System'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">{l.userName || l.user?.name || 'System'}</span>
                          <span className="badge bg-paper-100 text-ink-soft">{meta.label}</span>
                        </div>
                        <div className="mt-0.5 text-sm text-ink-soft">{l.details}</div>
                      </div>
                      <div className="whitespace-nowrap text-xs text-ink-faint">
                        {new Date(l.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
