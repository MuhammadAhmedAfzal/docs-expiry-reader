import { DocumentVersion } from '../models/DocumentVersion.js';
import { WORKFLOW_STATUSES } from '../models/Document.js';
import { HttpError } from '../utils/http.js';
import { parseDate } from '../utils/expiry.js';
import { syncDocumentNotifications } from './notifications.js';

const TEXT_FIELDS = ['title', 'documentNumber', 'category', 'description'];
const DATE_FIELDS = ['issueDate', 'expiryDate'];
export const TRACKED_FIELDS = [...TEXT_FIELDS, ...DATE_FIELDS, 'workflowStatus', 'assignedTo'];

// Multipart forms send everything as strings, so assignedTo may arrive as JSON or a comma list.
function parseIdList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  const text = String(value).trim();
  if (text.startsWith('[')) return JSON.parse(text).map(String);
  return text.split(',').map((id) => id.trim()).filter(Boolean);
}

// Picks and converts the editable fields present in a request body.
export function parseDocumentInput(body, { allowAssign }) {
  const input = {};
  for (const field of TEXT_FIELDS) {
    if (body[field] !== undefined) input[field] = String(body[field]).trim();
  }
  for (const field of DATE_FIELDS) {
    if (body[field] === undefined) continue;
    const date = parseDate(body[field]);
    if (date === undefined) throw new HttpError(400, `${field} is not a valid date (use YYYY-MM-DD)`);
    input[field] = date;
  }
  if (body.workflowStatus !== undefined) {
    if (!WORKFLOW_STATUSES.includes(body.workflowStatus)) throw new HttpError(400, 'Invalid workflow status');
    input.workflowStatus = body.workflowStatus;
  }
  if (allowAssign && body.assignedTo !== undefined) {
    try {
      input.assignedTo = parseIdList(body.assignedTo);
    } catch {
      throw new HttpError(400, 'assignedTo must be a list of user ids');
    }
  }
  return input;
}

function comparable(field, value) {
  if (value === undefined || value === null || value === '') return null;
  if (DATE_FIELDS.includes(field)) return new Date(value).toISOString().slice(0, 10);
  if (field === 'assignedTo') return value.map((id) => String(id?._id ?? id)).sort().join(',') || null;
  return String(value);
}

function displayValue(field, value) {
  if (field === 'assignedTo') return (value || []).map((id) => String(id?._id ?? id));
  return comparable(field, value);
}

// Applies changes to a document. When anything actually changes, the previous state
// (details and file) is saved as a DocumentVersion so old and new can be compared.
export async function updateDocumentWithHistory(doc, input, { user, newFile, changeNote }) {
  const changes = [];
  for (const field of TRACKED_FIELDS) {
    if (!(field in input)) continue;
    if (comparable(field, doc[field]) !== comparable(field, input[field])) {
      changes.push({ field, from: displayValue(field, doc[field]), to: displayValue(field, input[field]) });
    }
  }
  if (newFile) {
    changes.push({ field: 'file', from: doc.file?.originalName ?? null, to: newFile.originalName });
  }
  if (changes.length === 0) return { doc, changed: false };

  const old = doc.toObject();
  await DocumentVersion.create({
    document: doc._id,
    versionNumber: doc.version,
    snapshot: {
      title: old.title,
      documentNumber: old.documentNumber,
      category: old.category,
      description: old.description,
      issueDate: old.issueDate,
      expiryDate: old.expiryDate,
      workflowStatus: old.workflowStatus,
      expiryStatus: old.expiryStatus,
      assignedTo: (old.assignedTo || []).map((u) => u?._id ?? u),
    },
    file: old.file,
    changes,
    changeNote: changeNote?.trim() || undefined,
    changedBy: user._id,
  });

  // Old files are kept on disk because the version history still points to them.
  Object.assign(doc, input);
  if (newFile) doc.file = newFile;
  doc.version += 1;
  doc.updatedBy = user._id;
  await doc.save();
  await syncDocumentNotifications(doc);
  return { doc, changed: true };
}
