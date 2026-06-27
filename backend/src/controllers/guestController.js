import { supabase } from '../config/supabase.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/activity.js';
import {
  buildGuestFinance,
  buildFinanceForGuests,
  computeTotalCharges,
  round2,
} from '../utils/finance.js';
import { mapGuest, mapPayment, newId } from '../utils/map.js';

// GET /api/guests?search=&status=&room=
export const listGuests = asyncHandler(async (req, res) => {
  const { search, status, room } = req.query;
  let q = supabase.from('guests').select('*').order('created_at', { ascending: false });

  if (status === 'checked-in' || status === 'checked-out') q = q.eq('status', status);
  if (room) q = q.eq('room_number', String(room));
  if (search && typeof search === 'string' && search.trim()) {
    const s = search.trim().replace(/[%,]/g, ' ');
    // case-insensitive OR across the searchable fields
    q = q.or(
      `name.ilike.%${s}%,room_number.ilike.%${s}%,id_number.ilike.%${s}%,phone.ilike.%${s}%`
    );
  }

  const { data, error } = await q;
  if (error) throw new ApiError(400, error.message);

  const guests = (data || []).map(mapGuest);
  const rows = await buildFinanceForGuests(guests);
  res.json(rows.map(({ guest, finance }) => ({ ...guest, finance })));
});

export const getGuest = asyncHandler(async (req, res) => {
  const { data } = await supabase.from('guests').select('*').eq('id', req.params.id).single();
  if (!data) throw new ApiError(404, 'Guest not found');
  const guest = mapGuest(data);
  const finance = await buildGuestFinance(guest);
  const { data: pays } = await supabase
    .from('payments')
    .select('*')
    .eq('guest_id', guest._id)
    .order('date', { ascending: false });
  res.json({ ...guest, finance, payments: (pays || []).map(mapPayment) });
});

// POST /api/guests  (check-in)
export const checkIn = asyncHandler(async (req, res) => {
  const { name, idNumber, phone, roomId, checkInDate, expectedCheckOutDate } = req.body;
  if (!name || !idNumber || !phone || !roomId || !expectedCheckOutDate) {
    throw new ApiError(400, 'name, idNumber, phone, roomId and expectedCheckOutDate are required');
  }

  const ci = checkInDate ? new Date(checkInDate) : new Date();
  const co = new Date(expectedCheckOutDate);
  if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) {
    throw new ApiError(400, 'Invalid check-in or check-out date');
  }
  if (co <= ci) throw new ApiError(400, 'Expected check-out must be after check-in');

  // Atomically claim the room (only if available) — prevents double-booking.
  const { data: claimed, error: claimErr } = await supabase.rpc('claim_room', {
    p_room_id: String(roomId),
  });
  if (claimErr) throw new ApiError(400, claimErr.message);
  if (!claimed || !claimed.length) {
    const { data: existing } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (!existing) throw new ApiError(404, 'Room not found');
    throw new ApiError(400, `Room ${existing.number} is not available (${existing.status})`);
  }
  const room = claimed[0];

  const { data, error } = await supabase
    .from('guests')
    .insert({
      id: newId(),
      name,
      id_number: idNumber,
      phone,
      room_id: room.id,
      room_number: room.number,
      daily_rate: Number(room.daily_rate),
      check_in_date: ci.toISOString(),
      expected_check_out_date: co.toISOString(),
      created_by: req.user._id,
    })
    .select()
    .single();

  if (error) {
    // roll the room back so a failed insert doesn't strand it as occupied
    await supabase.from('rooms').update({ status: 'available' }).eq('id', room.id);
    throw new ApiError(400, error.message);
  }

  const guest = mapGuest(data);
  await logActivity(req, {
    action: 'CHECK_IN',
    entity: 'Guest',
    entityId: guest._id,
    details: `${guest.name} checked into room ${room.number}`,
  });
  res.status(201).json(guest);
});

// PATCH /api/guests/:id
export const updateGuest = asyncHandler(async (req, res) => {
  const { data: existing } = await supabase.from('guests').select('*').eq('id', req.params.id).single();
  if (!existing) throw new ApiError(404, 'Guest not found');
  if (existing.status === 'checked-out') throw new ApiError(400, 'Cannot edit a checked-out guest');

  const { name, idNumber, phone, expectedCheckOutDate } = req.body;
  const patch = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (idNumber !== undefined) patch.id_number = idNumber;
  if (phone !== undefined) patch.phone = phone;
  if (expectedCheckOutDate !== undefined) {
    const co = new Date(expectedCheckOutDate);
    if (co <= new Date(existing.check_in_date)) {
      throw new ApiError(400, 'Expected check-out must be after check-in');
    }
    patch.expected_check_out_date = co.toISOString();
  }

  const { data, error } = await supabase
    .from('guests')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw new ApiError(400, error.message);

  const guest = mapGuest(data);
  await logActivity(req, {
    action: 'GUEST_UPDATE',
    entity: 'Guest',
    entityId: guest._id,
    details: `${guest.name} details updated`,
  });
  res.json(guest);
});

// POST /api/guests/:id/checkout
export const checkOut = asyncHandler(async (req, res) => {
  const { data: existing } = await supabase.from('guests').select('*').eq('id', req.params.id).single();
  if (!existing) throw new ApiError(404, 'Guest not found');
  if (existing.status === 'checked-out') throw new ApiError(400, 'Guest is already checked out');

  const actual = req.body.actualCheckOutDate ? new Date(req.body.actualCheckOutDate) : new Date();
  if (Number.isNaN(actual.getTime())) throw new ApiError(400, 'Invalid check-out date');
  if (actual < new Date(existing.check_in_date)) {
    throw new ApiError(400, 'Check-out date cannot be before check-in');
  }

  const guestObj = mapGuest(existing);
  // Freeze charges while still 'checked-in' to get the real figure.
  const frozen = round2(
    computeTotalCharges({ ...guestObj, status: 'checked-in', actualCheckOutDate: actual })
  );

  const { data, error } = await supabase
    .from('guests')
    .update({
      actual_check_out_date: actual.toISOString(),
      status: 'checked-out',
      total_charges: frozen,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw new ApiError(400, error.message);

  // free the room
  if (existing.room_id) {
    await supabase.from('rooms').update({ status: 'available' }).eq('id', existing.room_id);
  }

  const guest = mapGuest(data);
  await logActivity(req, {
    action: 'CHECK_OUT',
    entity: 'Guest',
    entityId: guest._id,
    details: `${guest.name} checked out of room ${guest.roomNumber}`,
  });
  const finance = await buildGuestFinance(guest);
  res.json({ ...guest, finance });
});
