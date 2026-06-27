import Room from '../models/Room.js';
import Guest from '../models/Guest.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/activity.js';

export const listRooms = asyncHandler(async (req, res) => {
  const rooms = await Room.find().sort({ number: 1 });
  res.json(rooms);
});

export const createRoom = asyncHandler(async (req, res) => {
  const { number, type, dailyRate } = req.body;
  if (!number || !type || dailyRate == null) {
    throw new ApiError(400, 'number, type and dailyRate are required');
  }
  const room = await Room.create({ number, type, dailyRate });
  await logActivity(req, {
    action: 'ROOM_CREATE',
    entity: 'Room',
    entityId: room._id,
    details: `Room ${room.number} (${room.type}) @ ${room.dailyRate}`,
  });
  res.status(201).json(room);
});

export const updateRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw new ApiError(404, 'Room not found');

  const { number, type, dailyRate, status } = req.body;

  // Don't let a room with a checked-in guest be marked available/maintenance —
  // that would desync room/guest state and allow double-booking.
  if (status !== undefined && status !== 'occupied') {
    const activeGuest = await Guest.findOne({ room: room._id, status: 'checked-in' });
    if (activeGuest) {
      throw new ApiError(400, `Room ${room.number} has a checked-in guest`);
    }
  }

  if (number !== undefined) room.number = number;
  if (type !== undefined) room.type = type;
  if (dailyRate !== undefined) room.dailyRate = dailyRate;
  if (status !== undefined) room.status = status;
  await room.save();

  await logActivity(req, {
    action: 'ROOM_UPDATE',
    entity: 'Room',
    entityId: room._id,
    details: `Room ${room.number} updated`,
  });
  res.json(room);
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const activeGuest = await Guest.findOne({
    room: req.params.id,
    status: 'checked-in',
  });
  if (activeGuest) {
    throw new ApiError(400, 'Cannot delete a room with a checked-in guest');
  }
  const room = await Room.findByIdAndDelete(req.params.id);
  if (!room) throw new ApiError(404, 'Room not found');
  await logActivity(req, {
    action: 'ROOM_DELETE',
    entity: 'Room',
    entityId: room._id,
    details: `Room ${room.number} deleted`,
  });
  res.json({ message: 'Room deleted' });
});
