import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { HttpError, asyncHandler } from '../utils/http.js';
import { can } from '../utils/permissions.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired, please sign in again');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active) throw new HttpError(401, 'Account not found or disabled');
  req.user = user;
  next();
});

export function requireAdmin(req, _res, next) {
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Only an admin can do this'));
  next();
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!can(req.user, permission)) return next(new HttpError(403, 'You do not have permission to do this'));
    next();
  };
}
