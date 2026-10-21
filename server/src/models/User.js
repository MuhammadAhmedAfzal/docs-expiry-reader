import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { DEFAULT_WORKER_PERMISSIONS } from '../utils/permissions.js';

const permissionFields = Object.fromEntries(
  Object.entries(DEFAULT_WORKER_PERMISSIONS).map(([key, value]) => [key, { type: Boolean, default: value }]),
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['admin', 'worker'], default: 'worker' },
    permissions: { type: new mongoose.Schema(permissionFields, { _id: false }), default: () => ({}) },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
