export default function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="mt-1 text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-faint">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

export function StatusBadge({ kind, children }) {
  const map = {
    'checked-in': 'bg-brand-50 text-brand-600',
    'checked-out': 'bg-paper-200 text-ink-soft',
    overdue: 'bg-rose-50 text-rose-600',
    outstanding: 'bg-amber-50 text-amber-700',
    paid: 'bg-brand-50 text-brand-600',
    available: 'bg-brand-50 text-brand-600',
    occupied: 'bg-amber-50 text-amber-700',
    maintenance: 'bg-amber-50 text-amber-700',
    ok: 'bg-brand-50 text-brand-600',
    low: 'bg-rose-50 text-rose-600',
    active: 'bg-brand-50 text-brand-600',
    disabled: 'bg-rose-50 text-rose-600',
    manager: 'bg-brand-50 text-brand-600',
    frontdesk: 'bg-amber-50 text-amber-700',
  };
  return <span className={`badge ${map[kind] || 'bg-paper-200 text-ink-soft'}`}>{children}</span>;
}

export function Avatar({ name, size = 'md' }) {
  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const sizes = { sm: 'h-8 w-8 text-[0.7rem]', md: 'h-9 w-9 text-[0.72rem]' };
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-600 ${sizes[size]}`}>
      {initials}
    </div>
  );
}
