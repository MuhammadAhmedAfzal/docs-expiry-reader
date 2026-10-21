// Permissions an admin can grant to a worker. Deleting documents is never grantable: admin only.
export const PERMISSIONS = {
  viewAllDocuments: 'View all documents (not only assigned ones)',
  createDocuments: 'Add new documents',
  editAllDocuments: 'Edit any document (not only assigned ones)',
  importDocuments: 'Bulk import documents from CSV',
  manageTasks: 'Create tasks and assign documents to workers',
};

export const DEFAULT_WORKER_PERMISSIONS = {
  viewAllDocuments: false,
  createDocuments: true,
  editAllDocuments: false,
  importDocuments: false,
  manageTasks: false,
};

const idOf = (value) => String(value?._id ?? value);

export function can(user, permission) {
  return user.role === 'admin' || Boolean(user.permissions?.[permission]);
}

export function isAssigned(user, doc) {
  return (doc.assignedTo || []).some((id) => idOf(id) === idOf(user._id));
}

export function canViewDocument(user, doc) {
  return can(user, 'viewAllDocuments') || isAssigned(user, doc) || idOf(doc.createdBy) === idOf(user._id);
}

export function canEditDocument(user, doc) {
  return can(user, 'editAllDocuments') || isAssigned(user, doc);
}

// Mongo filter restricting a document query to what the user may see.
export function documentScope(user) {
  if (can(user, 'viewAllDocuments')) return {};
  return { $or: [{ assignedTo: user._id }, { createdBy: user._id }] };
}
