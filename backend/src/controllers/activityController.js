import { supabase } from '../config/supabase.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { mapActivity } from '../utils/map.js';

// GET /api/activity?limit=&action=
export const listActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  let q = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (req.query.action) q = q.eq('action', String(req.query.action));

  const { data, error } = await q;
  if (error) throw new ApiError(400, error.message);
  res.json((data || []).map(mapActivity));
});
