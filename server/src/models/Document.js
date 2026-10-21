import mongoose from 'mongoose';
import { computeExpiryStatus, daysUntil } from '../utils/expiry.js';

export const WORKFLOW_STATUSES = ['new', 'in_progress', 'completed'];
export const EXPIRY_STATUSES = ['valid', 'expiring_soon', 'expired', 'no_expiry'];

export const fileSchema = new mongoose.Schema(
  {
    filename: String, // name on disk inside the upload directory
    originalName: String,
    mimeType: String,
    size: Number,
  },
  { _id: false },
);

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    documentNumber: { type: String, trim: true },
    category: { type: String, trim: true },
    description: { type: String, trim: true },
    issueDate: Date,
    expiryDate: Date,
    workflowStatus: { type: String, enum: WORKFLOW_STATUSES, default: 'new' },
    // Derived from expiryDate on every save and refreshed hourly by the scheduler.
    expiryStatus: { type: String, enum: EXPIRY_STATUSES, default: 'no_expiry' },
    file: fileSchema,
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    version: { type: Number, default: 1 },
    source: { type: String, enum: ['manual', 'import'], default: 'manual' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

documentSchema.virtual('daysLeft').get(function getDaysLeft() {
  return daysUntil(this.expiryDate);
});

documentSchema.pre('save', function updateExpiryStatus() {
  this.expiryStatus = computeExpiryStatus(this.expiryDate);
});

documentSchema.index({ expiryStatus: 1, expiryDate: 1 });
documentSchema.index({ assignedTo: 1 });
documentSchema.index({ title: 'text', documentNumber: 'text', description: 'text' });

export const Document = mongoose.model('Document', documentSchema);
