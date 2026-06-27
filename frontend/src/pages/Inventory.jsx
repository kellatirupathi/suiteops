import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client.js';
import Modal from '../components/Modal.jsx';
import PageHeader, { StatusBadge } from '../components/PageHeader.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const CATEGORIES = ['linen', 'toiletries', 'minibar', 'cleaning', 'other'];

export default function Inventory() {
  const toast = useToast();
  const { isManager } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowOnly, setLowOnly] = useState(false);
  const [cat, setCat] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/inventory', { params: lowOnly ? { lowOnly: true } : {} });
      setItems(data);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [lowOnly]);

  async function adjust(item, delta) {
    try {
      await api.patch(`/inventory/${item._id}/adjust`, { delta });
      load();
    } catch (e) { toast.error(apiError(e)); }
  }
  async function remove(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.delete(`/inventory/${item._id}`);
      toast.success('Item deleted');
      load();
    } catch (e) { toast.error(apiError(e)); }
  }

  const lowCount = items.filter((i) => i.quantity <= i.threshold).length;
  const shown = cat ? items.filter((i) => i.category === cat) : items;

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Housekeeping" title="Inventory" subtitle="Stock levels and low-stock alerts.">
        {isManager && (
          <button className="btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>
            <span className="text-base leading-none">＋</span> Add item
          </button>
        )}
      </PageHeader>

      {lowCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600">!</span>
          <span><b>{lowCount} item{lowCount > 1 ? 's' : ''}</b> at or below threshold — restock soon.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select className="input max-w-[180px]" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c[0].toUpperCase() + c.slice(1)}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm">
          <input type="checkbox" className="accent-brand-500" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-paper-200 bg-paper-50">
              <tr>
                <th className="th">Item</th>
                <th className="th">Category</th>
                <th className="th text-center">Stock level</th>
                <th className="th text-right">Threshold</th>
                <th className="th">Status</th>
                {isManager && <th className="th"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={6} className="td"><div className="h-6 animate-pulse rounded bg-paper-100" /></td></tr>
                ))
              ) : shown.length === 0 ? (
                <tr><td colSpan={6} className="td py-12 text-center text-ink-faint">No items.</td></tr>
              ) : (
                shown.map((i) => {
                  const low = i.quantity <= i.threshold;
                  const pct = i.threshold ? Math.min(100, (i.quantity / (i.threshold * 2)) * 100) : 100;
                  return (
                    <tr key={i._id} className="transition hover:bg-paper-50/60">
                      <td className="td font-medium text-ink">{i.name}</td>
                      <td className="td capitalize text-ink-soft">{i.category}</td>
                      <td className="td">
                        <div className="flex items-center justify-center gap-3">
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-300 text-ink-soft transition hover:border-ink-faint hover:text-ink" onClick={() => adjust(i, -1)}>−</button>
                          <div className="w-24 text-center">
                            <div className="text-sm font-semibold text-ink">{i.quantity} <span className="text-xs font-normal text-ink-faint">{i.unit}</span></div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-200">
                              <div className={`h-full rounded-full ${low ? 'bg-rose-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-300 text-ink-soft transition hover:border-ink-faint hover:text-ink" onClick={() => adjust(i, 1)}>+</button>
                        </div>
                      </td>
                      <td className="td text-right text-ink-soft">{i.threshold}</td>
                      <td className="td"><StatusBadge kind={low ? 'low' : 'ok'}>{low ? 'Low' : 'In stock'}</StatusBadge></td>
                      {isManager && (
                        <td className="td text-right">
                          <div className="flex justify-end gap-2">
                            <button className="btn-secondary btn-sm" onClick={() => { setEditItem(i); setShowForm(true); }}>Edit</button>
                            <button className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50" onClick={() => remove(i)}>Delete</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isManager && (
        <ItemForm open={showForm} item={editItem} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function ItemForm({ open, item, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', category: 'other', unit: 'unit', quantity: 0, threshold: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(item
      ? { name: item.name, category: item.category, unit: item.unit, quantity: item.quantity, threshold: item.threshold }
      : { name: '', category: 'other', unit: 'unit', quantity: 0, threshold: 0 });
  }, [open, item]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, quantity: Number(form.quantity), threshold: Number(form.threshold) };
      if (item) await api.patch(`/inventory/${item._id}`, payload);
      else await api.post('/inventory', payload);
      toast.success(item ? 'Item updated' : 'Item added');
      onDone();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Edit item' : 'Add inventory item'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" form="item-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Item name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="pcs, bottles…" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity</label>
            <input type="number" min="0" className="input" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </div>
          <div>
            <label className="label">Low-stock threshold</label>
            <input type="number" min="0" className="input" value={form.threshold} onChange={(e) => set('threshold', e.target.value)} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
