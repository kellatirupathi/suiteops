import 'dotenv/config';
import mongoose from 'mongoose';
import { supabase } from '../config/supabase.js';

// ============================================================
// One-time data copy: MongoDB (source, READ-ONLY) -> Supabase.
// MongoDB is never modified. Re-running upserts (safe to repeat).
//
//   npm run migrate
//
// Requires in .env:
//   MONGO_URI, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

const MONGO_URI = process.env.MONGO_URI;

function iso(d) {
  return d ? new Date(d).toISOString() : null;
}
function oid(v) {
  // ObjectId or populated doc -> hex string
  if (!v) return null;
  if (typeof v === 'object' && v._id) return String(v._id);
  return String(v);
}

async function upsert(table, rows) {
  if (!rows.length) {
    console.log(`  - ${table}: nothing to copy`);
    return;
  }
  // insert in chunks to stay well within limits
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await supabase.from(table).upsert(slice, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ ${table} upsert failed:`, error.message);
      throw error;
    }
  }
  console.log(`  ✓ ${table}: ${rows.length} rows copied`);
}

async function run() {
  if (!MONGO_URI) throw new Error('MONGO_URI is required to read source data');
  console.log('[migrate] connecting to MongoDB (read-only source)...');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('[migrate] connected:', mongoose.connection.name);

  // Read raw collections directly (no model coupling needed).
  const db = mongoose.connection.db;
  const read = async (name) => db.collection(name).find({}).toArray();

  const [users, rooms, guests, payments, inventory, activity] = await Promise.all([
    read('users'),
    read('rooms'),
    read('guests'),
    read('payments'),
    read('inventoryitems'),
    read('activitylogs'),
  ]);

  console.log(
    `[migrate] source counts -> users:${users.length} rooms:${rooms.length} guests:${guests.length} payments:${payments.length} inventory:${inventory.length} activity:${activity.length}`
  );

  // ---- transform to Supabase rows (snake_case, text ids) ----
  const userRows = users.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: (u.email || '').toLowerCase(),
    password_hash: u.passwordHash,
    role: u.role || 'frontdesk',
    active: u.active !== false,
    created_at: iso(u.createdAt) || new Date().toISOString(),
    updated_at: iso(u.updatedAt) || new Date().toISOString(),
  }));

  const roomRows = rooms.map((r) => ({
    id: String(r._id),
    number: String(r.number),
    type: r.type,
    daily_rate: Number(r.dailyRate),
    status: r.status || 'available',
    created_at: iso(r.createdAt) || new Date().toISOString(),
    updated_at: iso(r.updatedAt) || new Date().toISOString(),
  }));

  const guestRows = guests.map((g) => ({
    id: String(g._id),
    name: g.name,
    id_number: g.idNumber,
    phone: g.phone,
    room_id: oid(g.room),
    room_number: g.roomNumber,
    daily_rate: Number(g.dailyRate),
    check_in_date: iso(g.checkInDate),
    expected_check_out_date: iso(g.expectedCheckOutDate),
    actual_check_out_date: iso(g.actualCheckOutDate),
    status: g.status || 'checked-in',
    total_charges: Number(g.totalCharges || 0),
    created_by: oid(g.createdBy),
    created_at: iso(g.createdAt) || new Date().toISOString(),
    updated_at: iso(g.updatedAt) || new Date().toISOString(),
  }));

  const paymentRows = payments.map((p) => ({
    id: String(p._id),
    guest_id: oid(p.guest),
    amount: Number(p.amount),
    date: iso(p.date) || new Date().toISOString(),
    mode: p.mode,
    reference: p.reference || '',
    recorded_by: oid(p.recordedBy),
    created_at: iso(p.createdAt) || new Date().toISOString(),
  }));

  const inventoryRows = inventory.map((i) => ({
    id: String(i._id),
    name: i.name,
    category: i.category || 'other',
    unit: i.unit || 'unit',
    quantity: Number(i.quantity || 0),
    threshold: Number(i.threshold || 0),
    created_at: iso(i.createdAt) || new Date().toISOString(),
    updated_at: iso(i.updatedAt) || new Date().toISOString(),
  }));

  const activityRows = activity.map((a) => ({
    id: String(a._id),
    user_id: oid(a.user),
    user_name: a.userName || null,
    action: a.action,
    entity: a.entity || null,
    entity_id: a.entityId ? String(a.entityId) : null,
    details: a.details || '',
    created_at: iso(a.createdAt) || new Date().toISOString(),
  }));

  // ---- write to Supabase in FK-safe order ----
  console.log('[migrate] writing to Supabase...');
  await upsert('users', userRows);
  await upsert('rooms', roomRows);
  await upsert('guests', guestRows);
  await upsert('payments', paymentRows);
  await upsert('inventory_items', inventoryRows);
  await upsert('activity_logs', activityRows);

  console.log('[migrate] DONE. MongoDB was not modified.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('[migrate] FAILED:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
