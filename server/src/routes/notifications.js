import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { Document } from '../models/Document.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { can, documentScope } from '../utils/permissions.js';

const router = Router();
router.use(authenticate);

// Users see notifications only for documents they can see.
async function notificationScope(user) {
  if (can(user, 'viewAllDocuments')) return {};
  const ids = await Document.find(documentScope(user)).distinct('_id');
  return { document: { $in: ids } };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { ...(await notificationScope(req.user)), resolved: req.query.state === 'resolved' };
    if (req.query.type) filter.type = req.query.type;

    const notifications = await Notification.find(filter)
      .sort(filter.resolved ? { resolvedAt: -1 } : { type: 1, expiryDate: 1 })
      .limit(500)
      .populate({
        path: 'document',
        select: 'title documentNumber category expiryDate expiryStatus workflowStatus version assignedTo',
        populate: { path: 'assignedTo', select: 'name' },
      });

    const userId = String(req.user._id);
    res.json({
      notifications: notifications
        .filter((n) => n.document)
        .map((n) => ({ ...n.toJSON(), read: n.readBy.some((id) => String(id) === userId), readBy: undefined })),
    });
  }),
);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const base = { ...(await notificationScope(req.user)), resolved: false };
    const [expired, expiringSoon, unread] = await Promise.all([
      Notification.countDocuments({ ...base, type: 'expired' }),
      Notification.countDocuments({ ...base, type: 'expiring_soon' }),
      Notification.countDocuments({ ...base, readBy: { $ne: req.user._id } }),
    ]);
    res.json({ expired, expiringSoon, unread });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const filter = { ...(await notificationScope(req.user)), resolved: false };
    await Notification.updateMany(filter, { $addToSet: { readBy: req.user._id } });
    res.json({ message: 'All notifications marked as read' });
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id }, { $addToSet: { readBy: req.user._id } });
    res.json({ message: 'Marked as read' });
  }),
);

export default router;
