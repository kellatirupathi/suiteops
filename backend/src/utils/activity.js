import ActivityLog from '../models/ActivityLog.js';

// Fire-and-forget activity logging helper for the audit trail.
export async function logActivity(req, { action, entity, entityId, details }) {
  try {
    await ActivityLog.create({
      user: req.user?._id,
      userName: req.user?.name,
      action,
      entity,
      entityId,
      details,
    });
  } catch (err) {
    console.error('[activity] failed to log:', err.message);
  }
}
