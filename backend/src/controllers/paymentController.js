import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Guest from '../models/Guest.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/activity.js';
import { buildGuestFinance, buildFinanceForGuests } from '../utils/finance.js';

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

  const guest = await Guest.findById(guestId);
  if (!guest) throw new ApiError(404, 'Guest not found');

  const validModes = ['cash', 'card', 'upi'];
  if (!validModes.includes(mode)) {
    throw new ApiError(400, 'Payment mode must be cash, card or upi');
  }

  // Reject overpayment so the books always reconcile (paid never exceeds charges).
  const current = await buildGuestFinance(guest.toObject());
  if (amt > current.balanceDue + 0.001) {
    throw new ApiError(
      400,
      `Amount exceeds balance due (${current.balanceDue}). This guest has nothing more outstanding.`
    );
  }

  const payment = await Payment.create({
    guest: guest._id,
    amount: amt,
    mode,
    reference: reference || '',
    date: date ? new Date(date) : new Date(),
    recordedBy: req.user._id,
  });

  await logActivity(req, {
    action: 'PAYMENT',
    entity: 'Payment',
    entityId: payment._id,
    details: `Payment ${amt} (${mode}) for ${guest.name} [room ${guest.roomNumber}]`,
  });

  const updatedFinance = await buildGuestFinance(guest.toObject());
  res.status(201).json({ payment, finance: updatedFinance });
});

// GET /api/payments?guestId=
export const listPayments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.guestId) {
    if (!mongoose.isValidObjectId(req.query.guestId)) {
      throw new ApiError(400, 'Invalid guestId');
    }
    filter.guest = String(req.query.guestId);
  }
  const payments = await Payment.find(filter)
    .populate('guest', 'name roomNumber')
    .populate('recordedBy', 'name')
    .sort({ date: -1 });
  res.json(payments);
});

// GET /api/payments/dues  -> guests with outstanding balance
export const listDues = asyncHandler(async (req, res) => {
  const guests = await Guest.find().lean();
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
