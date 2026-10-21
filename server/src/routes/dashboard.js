import { Router } from 'express';
import { Document } from '../models/Document.js';
import { Task } from '../models/Task.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { documentScope } from '../utils/permissions.js';

const router = Router();
router.use(authenticate);

const LIST_FIELDS = 'title documentNumber category expiryDate expiryStatus workflowStatus version updatedAt createdAt';

const countBy = async (field, scope) => {
  const groups = await Document.aggregate([{ $match: scope }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return Object.fromEntries(groups.map((g) => [g._id, g.count]));
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = documentScope(req.user);

    const [total, byExpiry, byWorkflow, expiringSoon, expired, recentlyUpdated, openTasks] = await Promise.all([
      Document.countDocuments(scope),
      countBy('expiryStatus', scope),
      countBy('workflowStatus', scope),
      Document.find({ ...scope, expiryStatus: 'expiring_soon' }).sort({ expiryDate: 1 }).limit(8).select(LIST_FIELDS),
      Document.find({ ...scope, expiryStatus: 'expired' }).sort({ expiryDate: -1 }).limit(8).select(LIST_FIELDS),
      Document.find({ ...scope, version: { $gt: 1 } }).sort({ updatedAt: -1 }).limit(6).select(LIST_FIELDS),
      Task.find({ assignedTo: req.user._id, status: { $ne: 'done' } })
        .sort({ dueDate: 1 })
        .limit(6)
        .populate('document', 'title'),
    ]);

    res.json({
      counts: {
        total,
        valid: byExpiry.valid || 0,
        expiringSoon: byExpiry.expiring_soon || 0,
        expired: byExpiry.expired || 0,
        noExpiry: byExpiry.no_expiry || 0,
        new: byWorkflow.new || 0,
        inProgress: byWorkflow.in_progress || 0,
        completed: byWorkflow.completed || 0,
      },
      expiringSoon,
      expired,
      recentlyUpdated,
      openTasks,
    });
  }),
);

export default router;
