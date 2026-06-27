import crypto from 'crypto';

// Generate a 24-char hex id, matching the look of the old Mongo ObjectIds
// so existing data and the frontend keep working unchanged.
export function newId() {
  return crypto.randomBytes(12).toString('hex');
}

// ---- DB row (snake_case) -> API object (camelCase, _id) ----
// Each mapper keeps the SAME shape the frontend already expects.

export function mapUser(r) {
  if (!r) return null;
  return {
    _id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapRoom(r) {
  if (!r) return null;
  return {
    _id: r.id,
    number: r.number,
    type: r.type,
    dailyRate: Number(r.daily_rate),
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapGuest(r) {
  if (!r) return null;
  return {
    _id: r.id,
    name: r.name,
    idNumber: r.id_number,
    phone: r.phone,
    room: r.room_id,
    roomNumber: r.room_number,
    dailyRate: Number(r.daily_rate),
    checkInDate: r.check_in_date,
    expectedCheckOutDate: r.expected_check_out_date,
    actualCheckOutDate: r.actual_check_out_date,
    status: r.status,
    totalCharges: Number(r.total_charges),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapPayment(r) {
  if (!r) return null;
  return {
    _id: r.id,
    guest: r.guest_id,
    amount: Number(r.amount),
    date: r.date,
    mode: r.mode,
    reference: r.reference || '',
    recordedBy: r.recorded_by,
    createdAt: r.created_at,
  };
}

export function mapInventory(r) {
  if (!r) return null;
  const quantity = Number(r.quantity);
  const threshold = Number(r.threshold);
  return {
    _id: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    quantity,
    threshold,
    lowStock: quantity <= threshold,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapActivity(r) {
  if (!r) return null;
  return {
    _id: r.id,
    user: r.user_id,
    userName: r.user_name,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    details: r.details,
    createdAt: r.created_at,
  };
}
