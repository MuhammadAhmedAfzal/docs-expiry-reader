import mongoose from 'mongoose';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'];

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: Date,
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
  },
  { timestamps: true },
);

export const Task = mongoose.model('Task', taskSchema);
