import Room from '../models/Room.js';
import Guest from '../models/Guest.js';
import Payment from '../models/Payment.js';
import InventoryItem from '../models/InventoryItem.js';
import { asyncHandler } from '../middleware/error.js';
import { buildFinanceForGuests, round2 } from '../utils/finance.js';

function dayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function monthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// GET /api/analytics/dashboard
export const dashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const { start: dayStart, end: dayEnd } = dayBounds(now);
  const { start: monthStart, end: monthEnd } = monthBounds(now);

  // Run every independent query concurrently — one round-trip's worth of latency.
  const [
    totalRooms,
    occupiedRooms,
    checkInsToday,
    checkOutsToday,
    revToday,
    revMonth,
    guests,
    lowStockItems,
  ] = await Promise.all([
    Room.countDocuments(),
    Room.countDocuments({ status: 'occupied' }),
    Guest.countDocuments({ checkInDate: { $gte: dayStart, $lte: dayEnd } }),
    Guest.countDocuments({ actualCheckOutDate: { $gte: dayStart, $lte: dayEnd } }),
    Payment.aggregate([
      { $match: { date: { $gte: dayStart, $lte: dayEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Guest.find().lean(),
    InventoryItem.find().lean(),
  ]);

  const occupancyRate = totalRooms ? round2((occupiedRooms / totalRooms) * 100) : 0;

  // total pending dues across all guests (single payments aggregation)
  const enriched = await buildFinanceForGuests(guests, now);
  let totalPendingDues = 0;
  let overdueCount = 0;
  for (const { finance: f } of enriched) {
    totalPendingDues += f.balanceDue;
    if (f.overdue) overdueCount += 1;
  }

  const lowStockCount = lowStockItems.filter((i) => i.quantity <= i.threshold).length;

  res.json({
    rooms: { total: totalRooms, occupied: occupiedRooms, available: totalRooms - occupiedRooms, occupancyRate },
    today: {
      checkIns: checkInsToday,
      checkOuts: checkOutsToday,
      revenue: round2(revToday.length ? revToday[0].total : 0),
    },
    month: { revenue: round2(revMonth.length ? revMonth[0].total : 0) },
    dues: { totalPending: round2(totalPendingDues), overdueGuests: overdueCount },
    inventory: { lowStockCount },
    generatedAt: now,
  });
});
