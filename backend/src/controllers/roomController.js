import { supabase } from '../config/supabase.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/activity.js';
import { mapRoom, newId } from '../utils/map.js';

export const listRooms = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('number', { ascending: true });
  if (error) throw new ApiError(400, error.message);
  res.json((data || []).map(mapRoom));
});

export const createRoom = asyncHandler(async (req, res) => {
  const { number, type, dailyRate } = req.body;
  if (!number || !type || dailyRate == null) {
    throw new ApiError(400, 'number, type and dailyRate are required');
  }
  const { data, error } = await supabase
    .from('rooms')
    .insert({ id: newId(), number: String(number), type, daily_rate: Number(dailyRate) })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new ApiError(409, `Room ${number} already exists`);
    throw new ApiError(400, error.message);
  }
  const room = mapRoom(data);
  await logActivity(req, {
    action: 'ROOM_CREATE',
    entity: 'Room',
    entityId: room._id,
    details: `Room ${room.number} (${room.type}) @ ${room.dailyRate}`,
  });
  res.status(201).json(room);
});

export const updateRoom = asyncHandler(async (req, res) => {
  const { data: existing } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (!existing) throw new ApiError(404, 'Room not found');

  const { number, type, dailyRate, status } = req.body;

  // Don't let an occupied room (with a guest) be marked available/maintenance.
  if (status !== undefined && status !== 'occupied') {
    const { data: active } = await supabase
      .from('guests')
      .select('id')
      .eq('room_id', existing.id)
      .eq('status', 'checked-in')
      .limit(1);
    if (active && active.length) {
      throw new ApiError(400, `Room ${existing.number} has a checked-in guest`);
    }
  }

  const patch = { updated_at: new Date().toISOString() };
  if (number !== undefined) patch.number = String(number);
  if (type !== undefined) patch.type = type;
  if (dailyRate !== undefined) patch.daily_rate = Number(dailyRate);
  if (status !== undefined) patch.status = status;

  const { data, error } = await supabase
    .from('rooms')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw new ApiError(400, error.message);

  const room = mapRoom(data);
  await logActivity(req, {
    action: 'ROOM_UPDATE',
    entity: 'Room',
    entityId: room._id,
    details: `Room ${room.number} updated`,
  });
  res.json(room);
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const { data: active } = await supabase
    .from('guests')
    .select('id')
    .eq('room_id', req.params.id)
    .eq('status', 'checked-in')
    .limit(1);
  if (active && active.length) {
    throw new ApiError(400, 'Cannot delete a room with a checked-in guest');
  }
  const { data, error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) throw new ApiError(404, 'Room not found');
  await logActivity(req, {
    action: 'ROOM_DELETE',
    entity: 'Room',
    entityId: data.id,
    details: `Room ${data.number} deleted`,
  });
  res.json({ message: 'Room deleted' });
});
