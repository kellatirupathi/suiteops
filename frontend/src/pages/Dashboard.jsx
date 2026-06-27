import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../api/client.js';
import { money, fmtDateTime } from '../utils/format.js';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const toast = useToast();
  const { user, isManager } = useAuth();
  const [data, setData] = useState(null);
  const [dues, setDues] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const reqs = [api.get('/analytics/dashboard'), api.get('/payments/dues')];
      if (isManager) reqs.push(api.get('/activity', { params: { limit: 6 } }));
      const [d, du, ac] = await Promise.all(reqs);
      setData(d.data);
      setDues(du.data);
      if (ac) setActivity(ac.data);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  if (loading) return <PageSkeleton />;
  if (!data) return <div className="text-ink-faint">No data available.</div>;

  const dateLabel = new Date(data.generatedAt).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{dateLabel}</div>
          <h1 className="mt-1 text-3xl font-semibold">Daily overview</h1>
        </div>
        <Link to="/guests" className="btn-primary">
          <PlusIcon /> New check-in
        </Link>
      </header>

      {/* Primary KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Occupancy"
          value={`${data.rooms.occupancyRate}%`}
          foot={`${data.rooms.occupied} of ${data.rooms.total} rooms in use`}
          to="/rooms"
          bar={data.rooms.occupancyRate}
        />
        <Kpi
          label="Revenue today"
          value={money(data.today.revenue)}
          foot={`${money(data.month.revenue)} this month`}
          accent="teal"
        />
        <Kpi
          label="Pending dues"
          value={money(data.dues.totalPending)}
          foot={
            data.dues.overdueGuests > 0
              ? `${data.dues.overdueGuests} guest(s) overdue`
              : 'No overdue guests'
          }
          accent={data.dues.totalPending > 0 ? 'rose' : 'teal'}
          to="/dues"
        />
        <Kpi
          label="Low on stock"
          value={data.inventory.lowStockCount}
          foot={data.inventory.lowStockCount ? 'Items need restocking' : 'All items healthy'}
          accent={data.inventory.lowStockCount ? 'brass' : 'teal'}
          to="/inventory"
        />
      </section>

      {/* Secondary strip */}
      <section className="card divide-y divide-paper-200 sm:flex sm:divide-x sm:divide-y-0">
        <MiniStat label="Check-ins today" value={data.today.checkIns} icon={<ArrowInIcon />} />
        <MiniStat label="Check-outs today" value={data.today.checkOuts} icon={<ArrowOutIcon />} />
        <MiniStat
          label="Available rooms"
          value={data.rooms.available}
          icon={<DoorIcon />}
          foot={`${data.rooms.total} total`}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Needs attention */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-paper-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">Needs attention</h2>
              <p className="text-xs text-ink-faint">Guests with an outstanding balance</p>
            </div>
            <Link to="/dues" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all →
            </Link>
          </div>
          {dues.length === 0 ? (
            <Empty text="Every guest is settled up. 🎉" />
          ) : (
            <ul className="divide-y divide-paper-100">
              {dues.slice(0, 5).map((d) => (
                <li key={d._id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={d.name} />
                    <div>
                      <Link to={`/guests/${d._id}`} className="text-sm font-medium text-ink hover:text-brand-600">
                        {d.name}
                      </Link>
                      <div className="text-xs text-ink-faint">Room {d.roomNumber}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-rose-600">{money(d.balanceDue)}</div>
                    {d.overdue ? (
                      <span className="badge badge-dot bg-rose-50 text-rose-600">Overdue</span>
                    ) : (
                      <span className="badge bg-amber-50 text-amber-700">Outstanding</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right column: activity (manager) or quick actions */}
        <div className="lg:col-span-2">
          {isManager ? (
            <div className="card h-full">
              <div className="border-b border-paper-200 px-5 py-4">
                <h2 className="text-lg font-semibold">Recent activity</h2>
                <p className="text-xs text-ink-faint">Latest staff actions</p>
              </div>
              {activity.length === 0 ? (
                <Empty text="No activity yet." />
              ) : (
                <ul className="space-y-0 px-5 py-2">
                  {activity.map((a) => (
                    <li key={a._id} className="flex gap-3 py-2.5">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${actionColor(a.action)}`} />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink-soft">{a.details}</div>
                        <div className="text-[0.72rem] text-ink-faint">
                          {a.userName || a.user?.name} · {fmtDateTime(a.createdAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="card h-full p-5">
              <h2 className="text-lg font-semibold">Quick actions</h2>
              <div className="mt-4 grid gap-2">
                <Link to="/guests" className="btn-primary justify-start">
                  <PlusIcon /> New check-in
                </Link>
                <Link to="/dues" className="btn-secondary justify-start">
                  <CardIcon /> Record a payment
                </Link>
                <Link to="/inventory" className="btn-secondary justify-start">
                  <BoxIcon /> Update inventory
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------- pieces ---------- */

function Kpi({ label, value, foot, accent = 'ink', to, bar }) {
  const accents = {
    ink: 'text-ink',
    teal: 'text-brand-500',
    rose: 'text-rose-600',
    brass: 'text-amber-700',
  };
  const inner = (
    <div className="card group h-full p-5 transition hover:shadow-lift">
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${accents[accent]}`}>{value}</div>
      {bar != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-200">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, bar)}%` }} />
        </div>
      )}
      <div className="mt-2 text-xs text-ink-faint">{foot}</div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function MiniStat({ label, value, foot, icon }) {
  return (
    <div className="flex flex-1 items-center gap-4 px-5 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none">{value}</div>
        <div className="mt-1 text-xs text-ink-faint">
          {label}
          {foot ? ` · ${foot}` : ''}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-[0.72rem] font-semibold text-brand-600">
      {initials}
    </div>
  );
}

function Empty({ text }) {
  return <div className="px-5 py-10 text-center text-sm text-ink-faint">{text}</div>;
}

function actionColor(a) {
  if (a === 'CHECK_IN') return 'bg-brand-500';
  if (a === 'CHECK_OUT') return 'bg-ink-faint';
  if (a === 'PAYMENT') return 'bg-amber-500';
  if (a?.startsWith('INVENTORY')) return 'bg-amber-500';
  if (a?.startsWith('ROOM')) return 'bg-violet-500';
  return 'bg-paper-300';
}

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-paper-200" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-paper-200" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-2xl bg-paper-200" />
    </div>
  );
}

/* icons */
function ic(p) { return { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', className: 'h-5 w-5', ...p }; }
function PlusIcon(p) { return <svg {...ic(p)}><path d="M12 5v14M5 12h14" /></svg>; }
function CardIcon(p) { return <svg {...ic(p)}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /></svg>; }
function BoxIcon(p) { return <svg {...ic(p)}><path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z" /><path d="M3 8.5 12 14l9-5.5" /></svg>; }
function DoorIcon(p) { return <svg {...ic(p)}><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18" /></svg>; }
function ArrowInIcon(p) { return <svg {...ic(p)}><path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" /></svg>; }
function ArrowOutIcon(p) { return <svg {...ic(p)}><path d="M9 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h4M16 17l5-5-5-5M21 12H9" /></svg>; }
