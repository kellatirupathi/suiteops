import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { newId } from './map.js';
import { computeTotalCharges, round2 } from './finance.js';

// Seed a fresh Supabase database with realistic RK Suites data.
//   npm run seed            -> insert only if empty (idempotent-ish)
//   npm run seed -- --reset -> wipe all tables then reseed
const RESET = process.argv.includes('--reset') || process.argv.includes('--fresh');

const day = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * day);
const daysAhead = (n) => new Date(now.getTime() + n * day);
const iso = (d) => new Date(d).toISOString();

async function run() {
  console.log('[seed] seeding RK Suites into Supabase...');

  if (RESET) {
    console.log('[seed] --reset: clearing tables...');
    // delete in FK-safe order; .neq matches all rows
    for (const t of ['activity_logs', 'payments', 'guests', 'inventory_items', 'rooms', 'users']) {
      await supabase.from(t).delete().neq('id', '___none___');
    }
  }

  // ---------------- Users ----------------
  async function upsertUser({ name, email, password, role }) {
    const { data: existing } = await supabase.from('users').select('*').eq('email', email).single();
    if (existing) return existing;
    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert({ id: newId(), name, email, password_hash, role })
      .select()
      .single();
    if (error) throw error;
    console.log(`  + ${role}: ${email}`);
    return data;
  }

  const manager = await upsertUser({
    name: 'Rajesh Kumar',
    email: process.env.SEED_MANAGER_EMAIL || 'manager@rksuites.com',
    password: process.env.SEED_MANAGER_PASSWORD || 'Manager@123',
    role: 'manager',
  });
  const frontdesk = await upsertUser({
    name: 'Priya Sharma',
    email: process.env.SEED_FRONTDESK_EMAIL || 'frontdesk@rksuites.com',
    password: process.env.SEED_FRONTDESK_PASSWORD || 'Frontdesk@123',
    role: 'frontdesk',
  });
  await upsertUser({ name: 'Arjun Reddy', email: 'arjun@rksuites.com', password: 'Frontdesk@123', role: 'frontdesk' });

  // ---------------- Rooms ----------------
  const roomDefs = [
    { number: '101', type: 'Standard', dailyRate: 1800 },
    { number: '102', type: 'Standard', dailyRate: 1800 },
    { number: '103', type: 'Standard', dailyRate: 1800 },
    { number: '104', type: 'Standard', dailyRate: 1800 },
    { number: '201', type: 'Deluxe', dailyRate: 2800 },
    { number: '202', type: 'Deluxe', dailyRate: 2800 },
    { number: '203', type: 'Deluxe', dailyRate: 2800 },
    { number: '204', type: 'Deluxe', dailyRate: 2800 },
    { number: '301', type: 'Executive Suite', dailyRate: 4500 },
    { number: '302', type: 'Executive Suite', dailyRate: 4500 },
    { number: '401', type: 'Premium Suite', dailyRate: 6500 },
  ];
  const rooms = {};
  for (const r of roomDefs) {
    let { data: room } = await supabase.from('rooms').select('*').eq('number', r.number).single();
    if (!room) {
      const ins = await supabase
        .from('rooms')
        .insert({ id: newId(), number: r.number, type: r.type, daily_rate: r.dailyRate, status: 'available' })
        .select()
        .single();
      room = ins.data;
      console.log(`  + room ${r.number}`);
    }
    rooms[r.number] = room;
  }
  await supabase.from('rooms').update({ status: 'maintenance' }).eq('number', '104');

  // ---------------- Guests + Payments + Activity ----------------
  const { count: guestCount } = await supabase
    .from('guests')
    .select('id', { count: 'exact', head: true });

  if (guestCount > 0 && !RESET) {
    console.log(`  = ${guestCount} guests already present (use --reset to rebuild)`);
  } else {
    const activity = [];
    async function checkInGuest(g) {
      const room = rooms[g.roomNo];
      const status = g.actualOut ? 'checked-out' : 'checked-in';
      const guestObj = {
        dailyRate: room.daily_rate,
        checkInDate: g.checkIn,
        expectedCheckOutDate: g.expectedOut,
        actualCheckOutDate: g.actualOut || null,
        status: 'checked-in',
      };
      const total = g.actualOut ? round2(computeTotalCharges(guestObj)) : 0;

      const id = newId();
      await supabase.from('guests').insert({
        id,
        name: g.name,
        id_number: g.idNumber,
        phone: g.phone,
        room_id: room.id,
        room_number: room.number,
        daily_rate: Number(room.daily_rate),
        check_in_date: iso(g.checkIn),
        expected_check_out_date: iso(g.expectedOut),
        actual_check_out_date: g.actualOut ? iso(g.actualOut) : null,
        status,
        total_charges: total,
        created_by: g.by.id,
      });
      if (!g.actualOut) {
        await supabase.from('rooms').update({ status: 'occupied' }).eq('id', room.id);
      }
      activity.push({
        id: newId(), user_id: g.by.id, user_name: g.by.name, action: 'CHECK_IN',
        entity: 'Guest', entity_id: id, details: `${g.name} checked into room ${room.number}`,
        created_at: iso(g.checkIn),
      });
      for (const p of g.payments || []) {
        const pid = newId();
        await supabase.from('payments').insert({
          id: pid, guest_id: id, amount: p.amount, mode: p.mode,
          reference: p.reference || '', date: iso(p.date), recorded_by: g.by.id,
        });
        activity.push({
          id: newId(), user_id: g.by.id, user_name: g.by.name, action: 'PAYMENT',
          entity: 'Payment', entity_id: pid,
          details: `Payment ₹${p.amount} (${p.mode}) for ${g.name} [room ${room.number}]`,
          created_at: iso(p.date),
        });
      }
      if (g.actualOut) {
        activity.push({
          id: newId(), user_id: g.by.id, user_name: g.by.name, action: 'CHECK_OUT',
          entity: 'Guest', entity_id: id, details: `${g.name} checked out of room ${room.number}`,
          created_at: iso(g.actualOut),
        });
      }
    }

    const guests = [
      { name: 'Ananya Iyer', idNumber: 'TN1042 8876', phone: '98841 23901', roomNo: '201', checkIn: daysAgo(2), expectedOut: daysAhead(1), by: frontdesk, payments: [{ amount: 5600, mode: 'upi', reference: 'UPI/AX1042', date: daysAgo(2) }] },
      { name: 'Vikram Malhotra', idNumber: 'DL0921 4456', phone: '99102 88341', roomNo: '301', checkIn: daysAgo(1), expectedOut: daysAhead(3), by: frontdesk, payments: [{ amount: 9000, mode: 'card', reference: 'XXXX-4412', date: daysAgo(1) }] },
      { name: 'Sneha Patil', idNumber: 'MH1289 7723', phone: '90042 11907', roomNo: '101', checkIn: now, expectedOut: daysAhead(2), by: frontdesk, payments: [{ amount: 1800, mode: 'cash', date: now }] },
      { name: 'Mohammed Faizal', idNumber: 'KL0712 3390', phone: '97448 56712', roomNo: '202', checkIn: daysAgo(3), expectedOut: daysAhead(1), by: manager, payments: [{ amount: 4000, mode: 'upi', reference: 'UPI/MF7821', date: daysAgo(3) }] },
      { name: 'Kavya Nair', idNumber: 'KL3398 1102', phone: '98951 30022', roomNo: '401', checkIn: now, expectedOut: daysAhead(4), by: frontdesk, payments: [] },
      { name: 'Rohan Gupta', idNumber: 'UP1190 6634', phone: '83758 99012', roomNo: '102', checkIn: daysAgo(4), expectedOut: daysAgo(1), by: frontdesk, payments: [{ amount: 2000, mode: 'cash', date: daysAgo(4) }] },
      { name: 'Deepika Rao', idNumber: 'KA7741 2208', phone: '96323 78451', roomNo: '203', checkIn: daysAgo(1), expectedOut: daysAhead(2), by: manager, payments: [{ amount: 8400, mode: 'card', reference: 'XXXX-9087', date: daysAgo(1) }] },
      { name: 'Aditya Verma', idNumber: 'RJ2261 5519', phone: '94133 21887', roomNo: '302', checkIn: daysAgo(2), expectedOut: daysAhead(1), by: frontdesk, payments: [{ amount: 6000, mode: 'upi', reference: 'UPI/AV3390', date: daysAgo(2) }] },
      { name: 'Sanjay Menon', idNumber: 'KL0091 8842', phone: '99461 22310', roomNo: '204', checkIn: daysAgo(9), expectedOut: daysAgo(6), actualOut: daysAgo(6), by: frontdesk, payments: [{ amount: 8400, mode: 'card', reference: 'XXXX-1120', date: daysAgo(9) }] },
      { name: 'Pooja Desai', idNumber: 'GJ5523 7741', phone: '90991 45567', roomNo: '103', checkIn: daysAgo(7), expectedOut: daysAgo(4), actualOut: daysAgo(4), by: manager, payments: [{ amount: 5400, mode: 'upi', reference: 'UPI/PD5567', date: daysAgo(4) }] },
      { name: 'Imran Sheikh', idNumber: 'TS8819 3302', phone: '97011 90043', roomNo: '301', checkIn: daysAgo(5), expectedOut: daysAgo(3), actualOut: daysAgo(3), by: frontdesk, payments: [{ amount: 9000, mode: 'cash', date: daysAgo(3) }] },
      { name: 'Lakshmi Krishnan', idNumber: 'TN6612 0098', phone: '98403 67219', roomNo: '101', checkIn: daysAgo(2), expectedOut: now, actualOut: now, by: frontdesk, payments: [{ amount: 3600, mode: 'card', reference: 'XXXX-7741', date: now }] },
    ];
    for (const g of guests) await checkInGuest(g);
    if (activity.length) await supabase.from('activity_logs').insert(activity);
    console.log(`  + ${guests.length} guests, payments & ${activity.length} activity entries`);
  }

  // ---------------- Inventory ----------------
  const invDefs = [
    { name: 'Bath Towels', category: 'linen', unit: 'pcs', quantity: 142, threshold: 60 },
    { name: 'Hand Towels', category: 'linen', unit: 'pcs', quantity: 88, threshold: 40 },
    { name: 'Bed Sheet Sets', category: 'linen', unit: 'sets', quantity: 54, threshold: 24 },
    { name: 'Pillow Covers', category: 'linen', unit: 'pcs', quantity: 31, threshold: 40 },
    { name: 'Shampoo (30ml)', category: 'toiletries', unit: 'bottles', quantity: 96, threshold: 50 },
    { name: 'Body Soap', category: 'toiletries', unit: 'bars', quantity: 210, threshold: 80 },
    { name: 'Dental Kits', category: 'toiletries', unit: 'kits', quantity: 18, threshold: 30 },
    { name: 'Mineral Water (1L)', category: 'minibar', unit: 'bottles', quantity: 168, threshold: 60 },
    { name: 'Soft Drinks', category: 'minibar', unit: 'cans', quantity: 74, threshold: 40 },
    { name: 'Snack Packs', category: 'minibar', unit: 'packs', quantity: 52, threshold: 30 },
    { name: 'Floor Cleaner', category: 'cleaning', unit: 'litres', quantity: 22, threshold: 12 },
    { name: 'Glass Cleaner', category: 'cleaning', unit: 'litres', quantity: 6, threshold: 10 },
    { name: 'Disinfectant', category: 'cleaning', unit: 'litres', quantity: 14, threshold: 10 },
  ];
  for (const i of invDefs) {
    const { data: exists } = await supabase.from('inventory_items').select('id').eq('name', i.name).single();
    if (!exists) {
      await supabase.from('inventory_items').insert({ id: newId(), ...i });
      console.log(`  + inventory ${i.name}`);
    }
  }

  console.log('[seed] done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err.message);
  process.exit(1);
});
