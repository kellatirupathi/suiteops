import Payment from '../models/Payment.js';

// Number of nights billed for a guest. Minimum 1 night.
// Uses actual checkout if present, otherwise expected checkout (for live dues),
// but never less than today for an in-house guest.
export function nightsBilled(guest, now = new Date()) {
  const start = new Date(guest.checkInDate);
  let end;
  if (guest.actualCheckOutDate) {
    end = new Date(guest.actualCheckOutDate);
  } else {
    const expected = new Date(guest.expectedCheckOutDate);
    end = expected > now ? expected : now;
  }
  const ms = end - start;
  const nights = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, nights);
}

export function computeTotalCharges(guest, now = new Date()) {
  // Once checked out, always use the frozen charge for stable historical
  // reporting (use != null so a legitimately-zero / comped stay is respected).
  if (guest.status === 'checked-out' && guest.totalCharges != null) {
    return guest.totalCharges;
  }
  return nightsBilled(guest, now) * guest.dailyRate;
}

export async function sumPayments(guestId) {
  const result = await Payment.aggregate([
    { $match: { guest: toObjectId(guestId) } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result.length ? result[0].total : 0;
}

// Build a finance snapshot from an already-known paid amount (no DB hit).
export function financeFromPaid(guest, paid, now = new Date()) {
  const totalCharges = computeTotalCharges(guest, now);
  const balanceDue = Math.max(0, round2(totalCharges - paid));
  const overdue =
    balanceDue > 0 &&
    ((guest.actualCheckOutDate && now > new Date(guest.actualCheckOutDate)) ||
      (!guest.actualCheckOutDate && now > new Date(guest.expectedCheckOutDate)));

  return {
    nights: nightsBilled(guest, now),
    totalCharges: round2(totalCharges),
    paid: round2(paid),
    balanceDue,
    fullyPaid: balanceDue <= 0,
    overdue,
  };
}

// Build a full financial snapshot for a single guest (one aggregation).
export async function buildGuestFinance(guest, now = new Date()) {
  const paid = await sumPayments(guest._id);
  return financeFromPaid(guest, paid, now);
}

// Sum payments for MANY guests in ONE aggregation -> Map(guestId -> total).
// Avoids the N+1 query problem when listing guests/dues/analytics.
export async function sumPaymentsForGuests(guestIds) {
  if (!guestIds.length) return new Map();
  const rows = await Payment.aggregate([
    { $match: { guest: { $in: guestIds.map(toObjectId) } } },
    { $group: { _id: '$guest', total: { $sum: '$amount' } } },
  ]);
  const map = new Map();
  for (const r of rows) map.set(String(r._id), r.total);
  return map;
}

// Attach a finance snapshot to a list of guests using a single payments query.
export async function buildFinanceForGuests(guests, now = new Date()) {
  const paidMap = await sumPaymentsForGuests(guests.map((g) => g._id));
  return guests.map((g) => ({
    guest: g,
    finance: financeFromPaid(g, paidMap.get(String(g._id)) || 0, now),
  }));
}

import mongoose from 'mongoose';
function toObjectId(id) {
  return id instanceof mongoose.Types.ObjectId
    ? id
    : new mongoose.Types.ObjectId(id);
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
