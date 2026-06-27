import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { mapUser, newId } from '../utils/map.js';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || typeof email !== 'string') {
    throw new ApiError(400, 'Email and password are required');
  }
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (!user || !user.active) throw new ApiError(401, 'Invalid credentials');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new ApiError(401, 'Invalid credentials');

  const token = signToken(user);
  res.json({ token, user: mapUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// Manager-only: create staff accounts
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email and password are required');
  }
  const { data: exists } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();
  if (exists) throw new ApiError(409, 'Email already in use');

  const passwordHash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: newId(),
      name,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      role: role === 'manager' ? 'manager' : 'frontdesk',
    })
    .select()
    .single();
  if (error) throw new ApiError(400, error.message);

  res.status(201).json({ user: mapUser(data) });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new ApiError(400, error.message);
  res.json((data || []).map(mapUser));
});

export const setUserActive = asyncHandler(async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (!user) throw new ApiError(404, 'User not found');
  if (user.id === req.user._id) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }
  const { data, error } = await supabase
    .from('users')
    .update({ active: !!req.body.active, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw new ApiError(400, error.message);
  res.json({ user: mapUser(data) });
});
