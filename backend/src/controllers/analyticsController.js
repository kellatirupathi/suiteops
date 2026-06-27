import { supabase } from '../config/supabase.js';
import { asyncHandler } from '../middleware/error.js';
import { buildFinanceForGuests, round2 } from '../utils/finance.js';
import { mapGuest, mapInventory } from '../utils/map.js';

function dayBounds(now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
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

  // Run independent queries concurrently.
  const [
    roomsRes,
    checkInsRes,
    checkOutsRes,
    revTodayRes,
    revMonthRes,
    guestsRes,
    invRes,
  ] = await Promise.all([
    supabase.from('rooms').select('status'),
    supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .gte('check_in_date', dayStart.toISOString())
      .lte('check_in_date', dayEnd.toISOString()),
    supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .gte('actual_check_out_date', dayStart.toISOString())
      .lte('actual_check_out_date', dayEnd.toISOString()),
    supabase
      .from('payments')
      .select('amount')
      .gte('date', dayStart.toISOString())
      .lte('date', dayEnd.toISOString()),
    supabase
      .from('payments')
      .select('amount')
      .gte('date', monthStart.toISOString())
      .lte('date', monthEnd.toISOString()),
    supabase.from('guests').select('*'),
    supabase.from('inventory_items').select('*'),
  ]);

  const rooms = roomsRes.data || [];
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length;
  const occupancyRate = totalRooms ? round2((occupiedRooms / totalRooms) * 100) : 0;

  const revToday = (revTodayRes.data || []).reduce((s, p) => s + Number(p.amount), 0);
  const revMonth = (revMonthRes.data || []).reduce((s, p) => s + Number(p.amount), 0);

  const guests = (guestsRes.data || []).map(mapGuest);
  const enriched = await buildFinanceForGuests(guests, now);
  let totalPendingDues = 0;
  let overdueCount = 0;
  for (const { finance: f } of enriched) {
    totalPendingDues += f.balanceDue;
    if (f.overdue) overdueCount += 1;
  }

  const lowStockCount = (invRes.data || [])
    .map(mapInventory)
    .filter((i) => i.quantity <= i.threshold).length;

  res.json({
    rooms: {
      total: totalRooms,
      occupied: occupiedRooms,
      available: totalRooms - occupiedRooms,
      occupancyRate,
    },
    today: {
      checkIns: checkInsRes.count || 0,
      checkOuts: checkOutsRes.count || 0,
      revenue: round2(revToday),
    },
    month: { revenue: round2(revMonth) },
    dues: { totalPending: round2(totalPendingDues), overdueGuests: overdueCount },
    inventory: { lowStockCount },
    generatedAt: now,
  });
});
