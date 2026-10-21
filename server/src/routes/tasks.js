import { Router } from 'express';
import { Task, TASK_STATUSES } from '../models/Task.js';
import { Document } from '../models/Document.js';
import { User } from '../models/User.js';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/http.js';
import { can } from '../utils/permissions.js';
import { parseDate } from '../utils/expiry.js';

const router = Router();
router.use(authenticate);

const populateTask = (query) =>
  query
    .populate('assignedTo', 'name email')
    .populate('assignedBy', 'name email')
    .populate('document', 'title documentNumber expiryDate expiryStatus workflowStatus');

// Giving a worker a task on a document also gives them edit access to that document.
async function assignDocumentToWorker(documentId, userId) {
  if (!documentId) return;
  const doc = await Document.findByIdAndUpdate(documentId, { $addToSet: { assignedTo: userId } });
  if (!doc) throw new HttpError(400, 'Linked document not found');
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (!can(req.user, 'manageTasks')) filter.assignedTo = req.user._id;
    else if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
    if (req.query.document) filter.document = req.query.document;

    const tasks = await populateTask(Task.find(filter).sort({ status: 1, dueDate: 1, createdAt: -1 }));
    res.json({ tasks });
  }),
);

router.post(
  '/',
  requirePermission('manageTasks'),
  asyncHandler(async (req, res) => {
    const { title, description, document, assignedTo, dueDate } = req.body || {};
    if (!title || !assignedTo) throw new HttpError(400, 'Title and assignee are required');
    if (!(await User.exists({ _id: assignedTo, active: true }))) throw new HttpError(400, 'Assignee not found');

    const due = parseDate(dueDate);
    if (due === undefined) throw new HttpError(400, 'Invalid due date');

    await assignDocumentToWorker(document || null, assignedTo);
    const task = await Task.create({
      title,
      description,
      document: document || undefined,
      assignedTo,
      assignedBy: req.user._id,
      dueDate: due,
    });
    res.status(201).json({ task: await populateTask(Task.findById(task._id)) });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) throw new HttpError(404, 'Task not found');

    const isManager = can(req.user, 'manageTasks');
    const isAssignee = String(task.assignedTo) === String(req.user._id);
    if (!isManager && !isAssignee) throw new HttpError(404, 'Task not found');

    const { status, title, description, dueDate, assignedTo, document } = req.body || {};
    if (status !== undefined) {
      if (!TASK_STATUSES.includes(status)) throw new HttpError(400, 'Invalid task status');
      task.status = status;
    }

    if (isManager) {
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (dueDate !== undefined) {
        const due = parseDate(dueDate);
        if (due === undefined) throw new HttpError(400, 'Invalid due date');
        task.dueDate = due;
      }
      if (assignedTo !== undefined) task.assignedTo = assignedTo;
      if (document !== undefined) task.document = document || undefined;
      if (assignedTo !== undefined || document !== undefined) await assignDocumentToWorker(task.document, task.assignedTo);
    } else if ([title, description, dueDate, assignedTo, document].some((v) => v !== undefined)) {
      throw new HttpError(403, 'You can only change the status of your tasks');
    }

    await task.save();
    res.json({ task: await populateTask(Task.findById(task._id)) });
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) throw new HttpError(404, 'Task not found');
    res.json({ message: 'Task deleted' });
  }),
);

export default router;
