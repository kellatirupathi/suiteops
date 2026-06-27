import ActivityLog from '../models/ActivityLog.js';
import { asyncHandler } from '../middleware/error.js';

// GET /api/activity?limit=&action=
export const listActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  const logs = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name role');
  res.json(logs);
});
