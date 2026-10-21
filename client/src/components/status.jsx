export const EXPIRY_LABELS = {
  valid: 'Valid',
  expiring_soon: 'Expiring soon',
  expired: 'Expired',
  no_expiry: 'No expiry',
};

export const WORKFLOW_LABELS = {
  new: 'New',
  in_progress: 'In progress',
  completed: 'Completed',
};

export const TASK_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export function ExpiryBadge({ status }) {
  return <span className={`badge expiry-${status}`}>{EXPIRY_LABELS[status] || status}</span>;
}

export function WorkflowBadge({ status }) {
  return <span className={`badge workflow-${status}`}>{WORKFLOW_LABELS[status] || status}</span>;
}

export function TaskBadge({ status }) {
  return <span className={`badge task-${status}`}>{TASK_LABELS[status] || status}</span>;
}

export function VersionBadge({ version }) {
  return version > 1 ? (
    <span className="badge version-updated" title="This document has been updated">Updated · v{version}</span>
  ) : (
    <span className="badge version-original">Original · v1</span>
  );
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function toInputDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

export function daysLeftText(days) {
  if (days === null || days === undefined) return '';
  if (days < 0) return `Expired ${Math.abs(days)} day${days === -1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

export function daysUntil(date) {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}
