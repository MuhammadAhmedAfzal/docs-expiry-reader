import { Router } from 'express';
import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { Task } from '../models/Task.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/http.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();
router.use(authenticate);

function pickPermissions(input = {}) {
  return Object.fromEntries(
    Object.keys(PERMISSIONS)
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, Boolean(input[key])]),
  );
}

// Lightweight list used by assignment dropdowns.
router.get(
  '/options',
  asyncHandler(async (_req, res) => {
    const users = await User.find({ active: true }).select('name email role').sort('name');
    res.json({ users });
  }),
);

router.get('/permissions', (_req, res) => res.json({ permissions: PERMISSIONS }));

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ role: 1, name: 1 });
    res.json({ users });
  }),
);

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, email, password, role = 'worker', permissions } = req.body || {};
    if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required');
    if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (!['admin', 'worker'].includes(role)) throw new HttpError(400, 'Invalid role');

    const user = await User.create({ name, email, password, role, permissions: pickPermissions(permissions) });
    res.status(201).json({ user });
  }),
);

router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    const { name, email, password, role, permissions, active } = req.body || {};
    const isSelf = String(user._id) === String(req.user._id);

    if (isSelf && (role === 'worker' || active === false)) {
      throw new HttpError(400, 'You cannot demote or disable your own account');
    }
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) {
      if (!['admin', 'worker'].includes(role)) throw new HttpError(400, 'Invalid role');
      user.role = role;
    }
    if (active !== undefined) user.active = Boolean(active);
    if (permissions) Object.assign(user.permissions, pickPermissions(permissions));
    if (password) {
      if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
      user.password = String(password);
    }
    await user.save();
    res.json({ user });
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) throw new HttpError(400, 'You cannot delete your own account');
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    await Document.updateMany({ assignedTo: user._id }, { $pull: { assignedTo: user._id } });
    await Task.deleteMany({ assignedTo: user._id });
    res.json({ message: 'User deleted' });
  }),
);

export default router;
