import mongoose from 'mongoose';
import { fileSchema } from './Document.js';

// A snapshot of a document as it was *before* an update. Version N holds the old
// details and file; `changes` lists what was changed to produce version N + 1.
const documentVersionSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    versionNumber: { type: Number, required: true },
    snapshot: {
      title: String,
      documentNumber: String,
      category: String,
      description: String,
      issueDate: Date,
      expiryDate: Date,
      workflowStatus: String,
      expiryStatus: String,
      assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    file: fileSchema,
    changes: [
      {
        _id: false,
        field: String,
        from: mongoose.Schema.Types.Mixed,
        to: mongoose.Schema.Types.Mixed,
      },
    ],
    changeNote: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

documentVersionSchema.index({ document: 1, versionNumber: -1 }, { unique: true });

export const DocumentVersion = mongoose.model('DocumentVersion', documentVersionSchema);
