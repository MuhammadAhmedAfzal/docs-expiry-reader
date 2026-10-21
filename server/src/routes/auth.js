import { Router } from 'express';
import { User } from '../models/User.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/http.js';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw new HttpError(400, 'Email and password are required');

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
    if (!user || !(await user.comparePassword(String(password)))) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    if (!user.active) throw new HttpError(403, 'Your account has been disabled');

    res.json({ token: signToken(user), user });
  }),
);

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) throw new HttpError(400, 'New password must be at least 6 characters');

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(String(currentPassword || '')))) throw new HttpError(400, 'Current password is incorrect');

    user.password = String(newPassword);
    await user.save();
    res.json({ message: 'Password changed' });
  }),
);

export default router;
