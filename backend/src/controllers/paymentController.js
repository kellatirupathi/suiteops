import { supabase } from '../config/supabase.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/activity.js';
import { buildGuestFinance, buildFinanceForGuests } from '../utils/finance.js';
import { mapGuest, mapPayment, newId } from '../utils/map.js';

// POST /api/payments
export const recordPayment = asyncHandler(async (req, res) => {
  const { guestId, amount, mode, reference, date } = req.body;
  if (!guestId || amount == null || !mode) {
    throw new ApiError(400, 'guestId, amount and mode are required');
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new ApiError(400, 'Amount must be a number greater than 0');
  }
  const validModes = ['cash', 'card', 'upi'];
  if (!validModes.includes(mode)) {
    throw new ApiError(400, 'Payment mode must be cash, card or upi');
  }

  const { data: g } = await supabase.from('guests').select('*').eq('id', guestId).single();
  if (!g) throw new ApiError(404, 'Guest not found');
  const guest = mapGuest(g);

  // Reject overpayment so the books always reconcile.
  const current = await buildGuestFinance(guest);
  if (amt > current.balanceDue + 0.001) {
    throw new ApiError(
      400,
      `Amount exceeds balance due (${current.balanceDue}). This guest has nothing more outstanding.`
    );
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      id: newId(),
      guest_id: guest._id,
      amount: amt,
      mode,
      reference: reference || '',
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      recorded_by: req.user._id,
    })
    .select()
    .single();
  if (error) throw new ApiError(400, error.message);

  const payment = mapPayment(data);
  await logActivity(req, {
    action: 'PAYMENT',
    entity: 'Payment',
    entityId: payment._id,
    details: `Payment ${amt} (${mode}) for ${guest.name} [room ${guest.roomNumber}]`,
  });

  const finance = await buildGuestFinance(guest);
  res.status(201).json({ payment, finance });
});

// GET /api/payments?guestId=
export const listPayments = asyncHandler(async (req, res) => {
  let q = supabase.from('payments').select('*').order('date', { ascending: false });
  if (req.query.guestId) q = q.eq('guest_id', String(req.query.guestId));

  const { data, error } = await q;
  if (error) throw new ApiError(400, error.message);
  const payments = (data || []).map(mapPayment);

  // stitch guest + recordedBy names in two batched lookups (no N+1)
  const guestIds = [...new Set(payments.map((p) => p.guest).filter(Boolean))];
  const userIds = [...new Set(payments.map((p) => p.recordedBy).filter(Boolean))];

  const [{ data: gs }, { data: us }] = await Promise.all([
    guestIds.length
      ? supabase.from('guests').select('id, name, room_number').in('id', guestIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from('users').select('id, name').in('id', userIds)
      : Promise.resolve({ data: [] }),
  ]);
  const gMap = new Map((gs || []).map((g) => [g.id, g]));
  const uMap = new Map((us || []).map((u) => [u.id, u]));

  res.json(
    payments.map((p) => ({
      ...p,
      guest: gMap.get(p.guest)
        ? { name: gMap.get(p.guest).name, roomNumber: gMap.get(p.guest).room_number }
        : null,
      recordedBy: uMap.get(p.recordedBy) ? { name: uMap.get(p.recordedBy).name } : null,
    }))
  );
});

// GET /api/payments/dues
export const listDues = asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('guests').select('*');
  if (error) throw new ApiError(400, error.message);

  const guests = (data || []).map(mapGuest);
  const enriched = await buildFinanceForGuests(guests);
  const rows = enriched
    .filter(({ finance }) => finance.balanceDue > 0)
    .map(({ guest: g, finance }) => ({
      _id: g._id,
      name: g.name,
      roomNumber: g.roomNumber,
      status: g.status,
      phone: g.phone,
      ...finance,
    }));
  rows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.balanceDue - a.balanceDue);
  res.json(rows);
});
