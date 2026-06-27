import Guest from '../models/Guest.js';
import Room from '../models/Room.js';
import Payment from '../models/Payment.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/activity.js';
import { buildGuestFinance, buildFinanceForGuests, computeTotalCharges, round2 } from '../utils/finance.js';

// GET /api/guests?search=&status=&room=
export const listGuests = asyncHandler(async (req, res) => {
  const { search, status, room } = req.query;
  const filter = {};
  // Coerce to strings so query-operator objects (?status[$ne]=) can't be injected.
  if (status === 'checked-in' || status === 'checked-out') filter.status = status;
  if (room) filter.roomNumber = String(room);
  if (search && typeof search === 'string' && search.trim()) {
    // Escape regex metacharacters to avoid ReDoS / invalid-pattern crashes.
    const esc = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(esc, 'i');
    filter.$or = [{ name: rx }, { roomNumber: rx }, { idNumber: rx }, { phone: rx }];
  }
  const guests = await Guest.find(filter).sort({ createdAt: -1 }).lean();

  // attach finance snapshot using ONE payments aggregation (no N+1)
  const rows = await buildFinanceForGuests(guests);
  res.json(rows.map(({ guest, finance }) => ({ ...guest, finance })));
});

export const getGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id).lean();
  if (!guest) throw new ApiError(404, 'Guest not found');
  const finance = await buildGuestFinance(guest);
  const payments = await Payment.find({ guest: guest._id }).sort({ date: -1 });
  res.json({ ...guest, finance, payments });
});

// POST /api/guests  (check-in)
export const checkIn = asyncHandler(async (req, res) => {
  const { name, idNumber, phone, roomId, checkInDate, expectedCheckOutDate } =
    req.body;

  if (!name || !idNumber || !phone || !roomId || !expectedCheckOutDate) {
    throw new ApiError(400, 'name, idNumber, phone, roomId and expectedCheckOutDate are required');
  }

  const ci = checkInDate ? new Date(checkInDate) : new Date();
  const co = new Date(expectedCheckOutDate);
  if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) {
    throw new ApiError(400, 'Invalid check-in or check-out date');
  }
  if (co <= ci) {
    throw new ApiError(400, 'Expected check-out must be after check-in');
  }

  // Atomically claim the room: only succeeds if it's currently available.
  // This prevents a check-then-set race that could double-book a room.
  const room = await Room.findOneAndUpdate(
    { _id: roomId, status: 'available' },
    { status: 'occupied' },
    { new: true }
  );
  if (!room) {
    const existing = await Room.findById(roomId);
    if (!existing) throw new ApiError(404, 'Room not found');
    throw new ApiError(400, `Room ${existing.number} is not available (${existing.status})`);
  }

  let guest;
  try {
    guest = await Guest.create({
      name,
      idNumber,
      phone,
      room: room._id,
      roomNumber: room.number,
      dailyRate: room.dailyRate,
      checkInDate: ci,
      expectedCheckOutDate: co,
      createdBy: req.user._id,
    });
  } catch (err) {
    // roll the room back so a failed create doesn't strand it as occupied
    await Room.findByIdAndUpdate(room._id, { status: 'available' });
    throw err;
  }

  await logActivity(req, {
    action: 'CHECK_IN',
    entity: 'Guest',
    entityId: guest._id,
    details: `${guest.name} checked into room ${room.number}`,
  });

  res.status(201).json(guest);
});

// PATCH /api/guests/:id  (edit details while checked-in)
export const updateGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found');
  if (guest.status === 'checked-out') {
    throw new ApiError(400, 'Cannot edit a checked-out guest');
  }
  const { name, idNumber, phone, expectedCheckOutDate } = req.body;
  if (name !== undefined) guest.name = name;
  if (idNumber !== undefined) guest.idNumber = idNumber;
  if (phone !== undefined) guest.phone = phone;
  if (expectedCheckOutDate !== undefined) {
    const co = new Date(expectedCheckOutDate);
    if (co <= new Date(guest.checkInDate)) {
      throw new ApiError(400, 'Expected check-out must be after check-in');
    }
    guest.expectedCheckOutDate = co;
  }
  await guest.save();
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
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw new ApiError(404, 'Guest not found');
  if (guest.status === 'checked-out') {
    throw new ApiError(400, 'Guest is already checked out');
  }

  const actual = req.body.actualCheckOutDate
    ? new Date(req.body.actualCheckOutDate)
    : new Date();
  if (actual < new Date(guest.checkInDate)) {
    throw new ApiError(400, 'Check-out date cannot be before check-in');
  }

  // Freeze charges BEFORE flipping status — computeTotalCharges returns the
  // already-frozen value for checked-out guests, so we must compute while the
  // guest is still 'checked-in' to get the real figure.
  guest.totalCharges = round2(
    computeTotalCharges({ ...guest.toObject(), status: 'checked-in', actualCheckOutDate: actual })
  );
  guest.actualCheckOutDate = actual;
  guest.status = 'checked-out';
  await guest.save();

  // free the room
  await Room.findByIdAndUpdate(guest.room, { status: 'available' });

  await logActivity(req, {
    action: 'CHECK_OUT',
    entity: 'Guest',
    entityId: guest._id,
    details: `${guest.name} checked out of room ${guest.roomNumber}`,
  });

  const finance = await buildGuestFinance(guest.toObject());
  res.json({ ...guest.toObject(), finance });
});
