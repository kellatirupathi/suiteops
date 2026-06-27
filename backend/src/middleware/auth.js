import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { mapUser } from '../utils/map.js';

export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !data || !data.active) {
      return res.status(401).json({ message: 'User no longer active' });
    }
    req.user = mapUser(data);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Role-based access control. authorize('manager') -> only managers
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}
