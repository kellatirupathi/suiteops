import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Room from '../models/Room.js';
import Guest from '../models/Guest.js';
import Payment from '../models/Payment.js';
import InventoryItem from '../models/InventoryItem.js';
import ActivityLog from '../models/ActivityLog.js';
import { computeTotalCharges, round2 } from './finance.js';

const RESET = process.argv.includes('--reset') || process.argv.includes('--fresh');

const day = 24 * 60 * 60 * 1000;
const now = new Date();
function daysAgo(n) {
  return new Date(now.getTime() - n * day);
}
function daysAhead(n) {
  return new Date(now.getTime() + n * day);
}
function at(date, hour, min = 0) {
  const d = new Date(date);
  d.setHours(hour, min, 0, 0);
  return d;
}

async function upsertUser({ name, email, password, role }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ name, email, role });
    await user.setPassword(password);
    await user.save();
    console.log(`  + ${role}: ${email}`);
  }
  return user;
}

async function run() {
  await connectDB();

  if (RESET) {
    console.log('[seed] --reset: clearing existing collections...');
    await Promise.all([
      Guest.deleteMany({}),
      Payment.deleteMany({}),
      InventoryItem.deleteMany({}),
      ActivityLog.deleteMany({}),
      Room.deleteMany({}),
    ]);
  }

  console.log('[seed] seeding RK Suites...');

  // ---------------- Staff ----------------
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
  // a second front-desk staffer for a realistic team
  await upsertUser({
    name: 'Arjun Reddy',
    email: 'arjun@rksuites.com',
    password: 'Frontdesk@123',
    role: 'frontdesk',
  });

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
    let room = await Room.findOne({ number: r.number });
    if (!room) {
      room = await Room.create({ ...r, status: 'available' });
      console.log(`  + room ${r.number}`);
    }
    rooms[r.number] = room;
  }
  // one room out for maintenance — realistic
  await Room.updateOne({ number: '104' }, { status: 'maintenance' });
  rooms['104'].status = 'maintenance';

  // ---------------- Guests + Payments ----------------
  // skip if guests already exist (idempotent unless --reset)
  const existingGuests = await Guest.countDocuments();
  if (existingGuests > 0 && !RESET) {
    console.log(`  = ${existingGuests} guests already present (use --reset to rebuild)`);
  } else {
    const activity = [];

    async function checkInGuest(g) {
      const room = rooms[g.roomNo];
      const guest = await Guest.create({
        name: g.name,
        idNumber: g.idNumber,
        phone: g.phone,
        room: room._id,
        roomNumber: room.number,
        dailyRate: room.dailyRate,
        checkInDate: g.checkIn,
        expectedCheckOutDate: g.expectedOut,
        actualCheckOutDate: g.actualOut || null,
        status: g.actualOut ? 'checked-out' : 'checked-in',
        createdBy: g.by._id,
      });
      if (g.actualOut) {
        guest.totalCharges = round2(computeTotalCharges(guest.toObject()));
        await guest.save();
      } else {
        await Room.updateOne({ _id: room._id }, { status: 'occupied' });
      }
      activity.push({
        user: g.by._id,
        userName: g.by.name,
        action: 'CHECK_IN',
        entity: 'Guest',
        entityId: guest._id,
        details: `${guest.name} checked into room ${room.number}`,
        createdAt: at(g.checkIn, 11, 20),
      });
      // payments
      for (const p of g.payments || []) {
        const payment = await Payment.create({
          guest: guest._id,
          amount: p.amount,
          mode: p.mode,
          reference: p.reference || '',
          date: p.date,
          recordedBy: g.by._id,
        });
        activity.push({
          user: g.by._id,
          userName: g.by.name,
          action: 'PAYMENT',
          entity: 'Payment',
          entityId: payment._id,
          details: `Payment ₹${p.amount} (${p.mode}) for ${guest.name} [room ${room.number}]`,
          createdAt: at(p.date, 12, 5),
        });
      }
      if (g.actualOut) {
        activity.push({
          user: g.by._id,
          userName: g.by.name,
          action: 'CHECK_OUT',
          entity: 'Guest',
          entityId: guest._id,
          details: `${guest.name} checked out of room ${room.number}`,
          createdAt: at(g.actualOut, 10, 30),
        });
      }
      return guest;
    }

    const guests = [
      // --- currently in-house ---
      {
        name: 'Ananya Iyer', idNumber: 'TN1042 8876', phone: '98841 23901', roomNo: '201',
        checkIn: daysAgo(2), expectedOut: daysAhead(1), by: frontdesk,
        payments: [{ amount: 5600, mode: 'upi', reference: 'UPI/AX1042', date: daysAgo(2) }],
      },
      {
        name: 'Vikram Malhotra', idNumber: 'DL0921 4456', phone: '99102 88341', roomNo: '301',
        checkIn: daysAgo(1), expectedOut: daysAhead(3), by: frontdesk,
        payments: [{ amount: 9000, mode: 'card', reference: 'XXXX-4412', date: daysAgo(1) }],
      },
      {
        name: 'Sneha Patil', idNumber: 'MH1289 7723', phone: '90042 11907', roomNo: '101',
        checkIn: now, expectedOut: daysAhead(2), by: frontdesk,
        payments: [{ amount: 1800, mode: 'cash', date: now }],
      },
      {
        name: 'Mohammed Faizal', idNumber: 'KL0712 3390', phone: '97448 56712', roomNo: '202',
        checkIn: daysAgo(3), expectedOut: daysAhead(1), by: manager,
        // partial — has balance
        payments: [{ amount: 4000, mode: 'upi', reference: 'UPI/MF7821', date: daysAgo(3) }],
      },
      {
        name: 'Kavya Nair', idNumber: 'KL3398 1102', phone: '98951 30022', roomNo: '401',
        checkIn: now, expectedOut: daysAhead(4), by: frontdesk,
        // no payment yet — full balance due
        payments: [],
      },
      {
        name: 'Rohan Gupta', idNumber: 'UP1190 6634', phone: '83758 99012', roomNo: '102',
        // overdue: expected out yesterday, still in-house with balance
        checkIn: daysAgo(4), expectedOut: daysAgo(1), by: frontdesk,
        payments: [{ amount: 2000, mode: 'cash', date: daysAgo(4) }],
      },
      {
        name: 'Deepika Rao', idNumber: 'KA7741 2208', phone: '96323 78451', roomNo: '203',
        checkIn: daysAgo(1), expectedOut: daysAhead(2), by: manager,
        payments: [{ amount: 8400, mode: 'card', reference: 'XXXX-9087', date: daysAgo(1) }],
      },
      {
        name: 'Aditya Verma', idNumber: 'RJ2261 5519', phone: '94133 21887', roomNo: '302',
        checkIn: daysAgo(2), expectedOut: daysAhead(1), by: frontdesk,
        // partial
        payments: [{ amount: 6000, mode: 'upi', reference: 'UPI/AV3390', date: daysAgo(2) }],
      },

      // --- checked out (history, drives month revenue + activity) ---
      {
        name: 'Sanjay Menon', idNumber: 'KL0091 8842', phone: '99461 22310', roomNo: '201',
        checkIn: daysAgo(9), expectedOut: daysAgo(6), actualOut: daysAgo(6), by: frontdesk,
        payments: [{ amount: 8400, mode: 'card', reference: 'XXXX-1120', date: daysAgo(9) }],
      },
      {
        name: 'Pooja Desai', idNumber: 'GJ5523 7741', phone: '90991 45567', roomNo: '301',
        checkIn: daysAgo(7), expectedOut: daysAgo(4), actualOut: daysAgo(4), by: manager,
        payments: [{ amount: 13500, mode: 'upi', reference: 'UPI/PD5567', date: daysAgo(4) }],
      },
      {
        name: 'Imran Sheikh', idNumber: 'TS8819 3302', phone: '97011 90043', roomNo: '101',
        checkIn: daysAgo(5), expectedOut: daysAgo(3), actualOut: daysAgo(3), by: frontdesk,
        payments: [{ amount: 3600, mode: 'cash', date: daysAgo(3) }],
      },
      {
        name: 'Lakshmi Krishnan', idNumber: 'TN6612 0098', phone: '98403 67219', roomNo: '202',
        // checked out TODAY -> shows in "check-outs today"
        checkIn: daysAgo(2), expectedOut: now, actualOut: now, by: frontdesk,
        payments: [{ amount: 5600, mode: 'card', reference: 'XXXX-7741', date: now }],
      },
    ];

    for (const g of guests) await checkInGuest(g);

    if (activity.length) {
      await ActivityLog.insertMany(activity);
    }
    console.log(`  + ${guests.length} guests, payments & ${activity.length} activity entries`);
  }

  // ---------------- Inventory ----------------
  const invDefs = [
    { name: 'Bath Towels', category: 'linen', unit: 'pcs', quantity: 142, threshold: 60 },
    { name: 'Hand Towels', category: 'linen', unit: 'pcs', quantity: 88, threshold: 40 },
    { name: 'Bed Sheet Sets', category: 'linen', unit: 'sets', quantity: 54, threshold: 24 },
    { name: 'Pillow Covers', category: 'linen', unit: 'pcs', quantity: 31, threshold: 40 }, // low
    { name: 'Shampoo (30ml)', category: 'toiletries', unit: 'bottles', quantity: 96, threshold: 50 },
    { name: 'Body Soap', category: 'toiletries', unit: 'bars', quantity: 210, threshold: 80 },
    { name: 'Dental Kits', category: 'toiletries', unit: 'kits', quantity: 18, threshold: 30 }, // low
    { name: 'Mineral Water (1L)', category: 'minibar', unit: 'bottles', quantity: 168, threshold: 60 },
    { name: 'Soft Drinks', category: 'minibar', unit: 'cans', quantity: 74, threshold: 40 },
    { name: 'Snack Packs', category: 'minibar', unit: 'packs', quantity: 52, threshold: 30 },
    { name: 'Floor Cleaner', category: 'cleaning', unit: 'litres', quantity: 22, threshold: 12 },
    { name: 'Glass Cleaner', category: 'cleaning', unit: 'litres', quantity: 6, threshold: 10 }, // low
    { name: 'Disinfectant', category: 'cleaning', unit: 'litres', quantity: 14, threshold: 10 },
  ];
  for (const i of invDefs) {
    const exists = await InventoryItem.findOne({ name: i.name });
    if (!exists) {
      await InventoryItem.create(i);
      console.log(`  + inventory ${i.name}`);
    }
  }

  console.log('[seed] done.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
