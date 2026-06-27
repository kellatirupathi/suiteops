import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler, ApiError } from '../middleware/error.js';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordHash'
  );
  if (!user || !user.active) throw new ApiError(401, 'Invalid credentials');

  const ok = await user.comparePassword(password);
  if (!ok) throw new ApiError(401, 'Invalid credentials');

  const token = signToken(user);
  res.json({ token, user: user.toJSON() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

// Manager-only: create staff accounts
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email and password are required');
  }
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, 'Email already in use');

  const user = new User({ name, email, role: role === 'manager' ? 'manager' : 'frontdesk' });
  await user.setPassword(password);
  await user.save();
  res.status(201).json({ user: user.toJSON() });
});

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

export const setUserActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (String(user._id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }
  user.active = !!req.body.active;
  await user.save();
  res.json({ user: user.toJSON() });
});
