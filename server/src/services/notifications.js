import { Document } from '../models/Document.js';
import { Notification } from '../models/Notification.js';
import { computeExpiryStatus } from '../utils/expiry.js';

const ALERT_STATUSES = ['expiring_soon', 'expired'];

// Keeps a document's open notification in line with its expiry status: one open alert
// while it is expiring soon or expired, none once it has been renewed.
export async function syncDocumentNotifications(doc) {
  const alertType = ALERT_STATUSES.includes(doc.expiryStatus) ? doc.expiryStatus : null;

  const stale = { document: doc._id, resolved: false };
  if (alertType) {
    stale.$or = [{ type: { $ne: alertType } }, { expiryDate: { $ne: doc.expiryDate } }];
  }
  await Notification.updateMany(stale, { resolved: true, resolvedAt: new Date() });

  if (alertType) {
    await Notification.updateOne(
      { document: doc._id, type: alertType, resolved: false },
      { $setOnInsert: { expiryDate: doc.expiryDate } },
      { upsert: true },
    );
  }
}

// Expiry status depends on today's date, so it is recomputed periodically.
export async function refreshAllExpiryStatuses() {
  const docs = await Document.find({}).select('expiryDate expiryStatus');
  let changed = 0;
  for (const doc of docs) {
    const status = computeExpiryStatus(doc.expiryDate);
    if (status !== doc.expiryStatus) {
      await Document.updateOne({ _id: doc._id }, { expiryStatus: status });
      doc.expiryStatus = status;
      changed += 1;
    }
    await syncDocumentNotifications(doc);
  }
  return { checked: docs.length, changed };
}

export function startExpiryScheduler(intervalMs = 60 * 60 * 1000) {
  const run = () =>
    refreshAllExpiryStatuses()
      .then(({ checked, changed }) => console.log(`Expiry check: ${checked} documents, ${changed} status changes`))
      .catch((err) => console.error('Expiry check failed:', err));
  run();
  return setInterval(run, intervalMs);
}
