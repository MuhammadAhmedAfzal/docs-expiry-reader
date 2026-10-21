import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import { Document } from '../models/Document.js';
import { DocumentVersion } from '../models/DocumentVersion.js';
import { Notification } from '../models/Notification.js';
import { Task } from '../models/Task.js';
import { config } from '../config.js';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth.js';
import { documentUpload, removeStoredFile, storedFileInfo } from '../middleware/upload.js';
import { HttpError, asyncHandler } from '../utils/http.js';
import { can, canEditDocument, canViewDocument, documentScope } from '../utils/permissions.js';
import { parseDocumentInput, updateDocumentWithHistory } from '../services/documents.js';
import { syncDocumentNotifications } from '../services/notifications.js';

const router = Router();
router.use(authenticate);

const USER_FIELDS = 'name email role';

function withAccess(user, doc) {
  return { ...doc.toJSON(), canEdit: canEditDocument(user, doc), canDelete: user.role === 'admin' };
}

async function loadDocument(req, { edit = false } = {}) {
  const doc = await Document.findById(req.params.id)
    .populate('assignedTo', USER_FIELDS)
    .populate('createdBy', USER_FIELDS)
    .populate('updatedBy', USER_FIELDS);
  if (!doc || !canViewDocument(req.user, doc)) throw new HttpError(404, 'Document not found');
  if (edit && !canEditDocument(req.user, doc)) throw new HttpError(403, 'You can only edit documents assigned to you');
  return doc;
}

// Removes an uploaded file if the request fails, so failed saves leave nothing behind.
function cleanupUploadOnError(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      removeStoredFile(req.file?.filename);
      throw err;
    }
  });
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, expiryStatus, workflowStatus, category, assignedTo, sort = 'expiryDate' } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const filters = [documentScope(req.user)];
    if (search) {
      const pattern = new RegExp(escapeRegex(String(search)), 'i');
      filters.push({ $or: [{ title: pattern }, { documentNumber: pattern }, { category: pattern }, { description: pattern }] });
    }
    if (expiryStatus) filters.push({ expiryStatus: { $in: String(expiryStatus).split(',') } });
    if (workflowStatus) filters.push({ workflowStatus: { $in: String(workflowStatus).split(',') } });
    if (category) filters.push({ category });
    if (assignedTo) filters.push({ assignedTo });
    const query = { $and: filters };

    const sortOptions = {
      expiryDate: { expiryDate: 1, title: 1 },
      updated: { updatedAt: -1 },
      created: { createdAt: -1 },
      title: { title: 1 },
    };

    const [docs, total] = await Promise.all([
      Document.find(query)
        .sort(sortOptions[sort] || sortOptions.expiryDate)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('assignedTo', USER_FIELDS),
      Document.countDocuments(query),
    ]);

    res.json({ documents: docs.map((doc) => withAccess(req.user, doc)), total, page, pages: Math.ceil(total / limit) || 1 });
  }),
);

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await Document.distinct('category', documentScope(req.user));
    res.json({ categories: categories.filter(Boolean).sort() });
  }),
);

router.post(
  '/',
  requirePermission('createDocuments'),
  documentUpload.single('file'),
  cleanupUploadOnError(async (req, res) => {
    const canAssign = can(req.user, 'manageTasks');
    const input = parseDocumentInput(req.body, { allowAssign: canAssign });
    if (!input.title) throw new HttpError(400, 'Title is required');
    // Workers who cannot assign own the documents they add.
    if (!canAssign || !input.assignedTo?.length) input.assignedTo = canAssign ? [] : [req.user._id];

    const doc = await Document.create({
      ...input,
      file: storedFileInfo(req.file),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await syncDocumentNotifications(doc);
    res.status(201).json({ document: doc });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await loadDocument(req);
    res.json({ document: withAccess(req.user, doc) });
  }),
);

router.patch(
  '/:id',
  documentUpload.single('file'),
  cleanupUploadOnError(async (req, res) => {
    const doc = await loadDocument(req, { edit: true });
    const input = parseDocumentInput(req.body, { allowAssign: can(req.user, 'manageTasks') });
    if ('title' in input && !input.title) throw new HttpError(400, 'Title is required');

    const { changed } = await updateDocumentWithHistory(doc, input, {
      user: req.user,
      newFile: storedFileInfo(req.file),
      changeNote: req.body.changeNote,
    });
    const updated = await loadDocument(req);
    res.json({ document: withAccess(req.user, updated), changed });
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const doc = await Document.findById(req.params.id);
    if (!doc) throw new HttpError(404, 'Document not found');

    const versions = await DocumentVersion.find({ document: doc._id }).select('file');
    for (const filename of new Set([doc.file?.filename, ...versions.map((v) => v.file?.filename)])) {
      removeStoredFile(filename);
    }
    await Promise.all([
      DocumentVersion.deleteMany({ document: doc._id }),
      Notification.deleteMany({ document: doc._id }),
      Task.updateMany({ document: doc._id }, { $unset: { document: 1 } }),
      doc.deleteOne(),
    ]);
    res.json({ message: 'Document deleted' });
  }),
);

router.get(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const doc = await loadDocument(req);
    const versions = await DocumentVersion.find({ document: doc._id })
      .sort({ versionNumber: -1 })
      .populate('changedBy', USER_FIELDS)
      .populate('snapshot.assignedTo', USER_FIELDS);
    res.json({ versions });
  }),
);

// Streams the current file, or the file of an older version with ?version=N.
router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const doc = await loadDocument(req);
    let file = doc.file;
    const versionNumber = Number(req.query.version);
    if (versionNumber && versionNumber !== doc.version) {
      const version = await DocumentVersion.findOne({ document: doc._id, versionNumber });
      if (!version) throw new HttpError(404, 'Version not found');
      file = version.file;
    }
    if (!file?.filename) throw new HttpError(404, 'This version has no file attached');

    const filePath = path.join(config.uploadDir, path.basename(file.filename));
    if (!fs.existsSync(filePath)) throw new HttpError(404, 'File is missing from storage');

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName || file.filename)}`);
    fs.createReadStream(filePath).pipe(res);
  }),
);

export default router;
