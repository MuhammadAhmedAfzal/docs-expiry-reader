import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { Document, WORKFLOW_STATUSES } from '../models/Document.js';
import { User } from '../models/User.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { csvUpload } from '../middleware/upload.js';
import { HttpError, asyncHandler } from '../utils/http.js';
import { can } from '../utils/permissions.js';
import { parseDate } from '../utils/expiry.js';
import { syncDocumentNotifications } from '../services/notifications.js';

const router = Router();
router.use(authenticate, requirePermission('importDocuments'));

const TEMPLATE_COLUMNS = ['title', 'documentNumber', 'category', 'issueDate', 'expiryDate', 'description', 'assignedTo', 'workflowStatus'];

// Header names are matched loosely so "Expiry Date", "expiry_date" and "expiryDate" all work.
const COLUMN_ALIASES = {
  title: 'title', name: 'title', documentname: 'title',
  documentnumber: 'documentNumber', number: 'documentNumber', docnumber: 'documentNumber', referencenumber: 'documentNumber',
  category: 'category', type: 'category', documenttype: 'category',
  issuedate: 'issueDate', issued: 'issueDate',
  expirydate: 'expiryDate', expiry: 'expiryDate', expirationdate: 'expiryDate', expires: 'expiryDate',
  description: 'description', notes: 'description',
  assignedto: 'assignedTo', assignee: 'assignedTo', worker: 'assignedTo',
  workflowstatus: 'workflowStatus', status: 'workflowStatus',
};

const normalizeHeader = (header) => COLUMN_ALIASES[String(header).toLowerCase().replace(/[^a-z]/g, '')] ?? null;

router.get('/template', (_req, res) => {
  const example = [
    TEMPLATE_COLUMNS.join(','),
    'Trade License,TL-2024-001,License,2024-01-15,2026-12-31,Main office trade license,worker@example.com,new',
    'Fire Safety Certificate,FS-778,Certificate,15/03/2025,14/03/2026,,,in_progress',
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="documents-import-template.csv"');
  res.send(example);
});

// POST /api/import/documents?dryRun=true validates and previews; without dryRun it saves valid rows.
router.post(
  '/documents',
  csvUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Please choose a CSV file');
    const dryRun = req.query.dryRun === 'true';
    const canAssign = can(req.user, 'manageTasks');

    let records;
    try {
      records = parse(req.file.buffer, {
        columns: (headers) => headers.map(normalizeHeader),
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      });
    } catch (err) {
      throw new HttpError(400, `Could not read the CSV: ${err.message}`);
    }
    if (records.length === 0) throw new HttpError(400, 'The CSV has no data rows');
    if (records.length > 5000) throw new HttpError(400, 'Please import at most 5000 rows at a time');

    const users = await User.find({ active: true }).select('email');
    const userIdByEmail = new Map(users.map((u) => [u.email, u._id]));

    const rows = records.map((record, index) => {
      const errors = [];
      const data = {
        title: record.title || '',
        documentNumber: record.documentNumber || undefined,
        category: record.category || undefined,
        description: record.description || undefined,
      };
      if (!data.title) errors.push('Title is required');

      for (const field of ['issueDate', 'expiryDate']) {
        const date = parseDate(record[field]);
        if (date === undefined) errors.push(`${field} "${record[field]}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)`);
        else if (date) data[field] = date;
      }

      const status = (record.workflowStatus || 'new').toLowerCase().replace(/[\s-]+/g, '_');
      if (WORKFLOW_STATUSES.includes(status)) data.workflowStatus = status;
      else errors.push(`Status "${record.workflowStatus}" must be one of: ${WORKFLOW_STATUSES.join(', ')}`);

      const emails = (record.assignedTo || '').split(/[;,]/).map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (emails.length && !canAssign) errors.push('You do not have permission to assign documents to workers');
      const unknown = emails.filter((email) => !userIdByEmail.has(email));
      if (unknown.length) errors.push(`Unknown user email: ${unknown.join(', ')}`);
      data.assignedTo = canAssign ? emails.filter((e) => userIdByEmail.has(e)).map((e) => userIdByEmail.get(e)) : [req.user._id];

      // Row 1 is the header, so data starts at row 2 in the spreadsheet.
      return { row: index + 2, data, errors, assignedEmails: emails };
    });

    const validRows = rows.filter((r) => r.errors.length === 0);
    let imported = 0;
    if (!dryRun && validRows.length) {
      const docs = await Document.create(
        validRows.map((r) => ({ ...r.data, source: 'import', createdBy: req.user._id, updatedBy: req.user._id })),
      );
      await Promise.all(docs.map((doc) => syncDocumentNotifications(doc)));
      imported = docs.length;
    }

    res.json({
      dryRun,
      total: rows.length,
      validCount: validRows.length,
      errorCount: rows.length - validRows.length,
      imported,
      rows: rows.map(({ row, data, errors, assignedEmails }) => ({
        row,
        title: data.title,
        documentNumber: data.documentNumber,
        category: data.category,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        workflowStatus: data.workflowStatus,
        assignedTo: assignedEmails,
        errors,
      })),
    });
  }),
);

export default router;
