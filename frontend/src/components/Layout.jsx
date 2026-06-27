import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const nav = [
  {
    section: 'Operations',
    items: [
      { to: '/', label: 'Overview', icon: GridIcon, exact: true },
      { to: '/guests', label: 'Guest Register', icon: BedIcon },
      { to: '/dues', label: 'Payments & Dues', icon: CardIcon },
      { to: '/inventory', label: 'Inventory', icon: BoxIcon },
    ],
  },
  {
    section: 'Management',
    managerOnly: true,
    items: [
      { to: '/rooms', label: 'Rooms', icon: DoorIcon, managerOnly: true },
      { to: '/activity', label: 'Activity Log', icon: LogIcon, managerOnly: true },
      { to: '/staff', label: 'Staff', icon: UsersIcon, managerOnly: true },
    ],
  },
];

export default function Layout() {
  const { user, logout, isManager } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const sections = nav
    .filter((s) => !s.managerOnly || isManager)
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.managerOnly || isManager) }));

  const initials = (user?.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    // Full-height shell; nothing here scrolls — only <main> scrolls.
    <div className="flex h-screen overflow-hidden bg-paper-50">
      {/* Sidebar — fixed height, stays put while content scrolls */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 transform flex-col bg-sidebar text-slate-300 transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
            RK
          </div>
          <div className="leading-tight">
            <div className="text-[0.95rem] font-semibold text-white">SuitesOps</div>
            <div className="text-xs text-slate-400">RK Suites</div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {sections.map((s) => (
            <div key={s.section}>
              <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {s.section}
              </div>
              <div className="space-y-1">
                {s.items.map((n) => {
                  const Icon = n.icon;
                  return (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      end={n.exact}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-brand-500 font-medium text-white'
                            : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                          {n.label}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/5 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-active text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">{user?.name}</div>
              <div className="text-xs text-slate-400">{isManager ? 'Manager' : 'Front Desk'}</div>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main column — this is the only scroll container */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-paper-200 bg-white px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-ink-soft hover:bg-paper-100 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className="hidden text-sm text-ink-faint lg:block">
              {greeting()}, <span className="font-medium text-ink-soft">{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`badge ${
                isManager ? 'bg-brand-50 text-brand-600' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isManager ? 'Manager access' : 'Front desk'}
            </span>
            <button onClick={handleLogout} className="btn-secondary btn-sm">
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ---- inline icons (stroke, 1.6) ---- */
function base(props) {
  return {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24',
    ...props,
  };
}
function GridIcon(p) { return (<svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>); }
function BedIcon(p) { return (<svg {...base(p)}><path d="M3 7v11M3 12h18v6M21 18v-4a3 3 0 0 0-3-3H9"/><circle cx="6.5" cy="9.5" r="1.5"/></svg>); }
function CardIcon(p) { return (<svg {...base(p)}><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19M6 14.5h4"/></svg>); }
function BoxIcon(p) { return (<svg {...base(p)}><path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z"/><path d="M3 8.5 12 14l9-5.5M12 14v7"/></svg>); }
function DoorIcon(p) { return (<svg {...base(p)}><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="14.5" cy="12" r="1"/></svg>); }
function LogIcon(p) { return (<svg {...base(p)}><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 10h8M8 14h6"/></svg>); }
function UsersIcon(p) { return (<svg {...base(p)}><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6a3 3 0 0 1 0 6M20.5 19a5 5 0 0 0-3.5-4.8"/></svg>); }
function MenuIcon(p) { return (<svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16"/></svg>); }
