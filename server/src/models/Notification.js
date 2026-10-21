import mongoose from 'mongoose';

// Raised when a document becomes expiring soon or expired. It stays active until the
// document is renewed with a new expiry date, which marks it resolved.
const notificationSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    type: { type: String, enum: ['expiring_soon', 'expired'], required: true },
    expiryDate: Date,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

notificationSchema.index({ document: 1, type: 1, resolved: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
