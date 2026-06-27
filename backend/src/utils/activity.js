import { supabase } from '../config/supabase.js';
import { newId } from './map.js';

// Fire-and-forget activity logging helper for the audit trail.
export async function logActivity(req, { action, entity, entityId, details }) {
  try {
    await supabase.from('activity_logs').insert({
      id: newId(),
      user_id: req.user?._id || null,
      user_name: req.user?.name || null,
      action,
      entity,
      entity_id: entityId,
      details,
    });
  } catch (err) {
    console.error('[activity] failed to log:', err.message);
  }
}
