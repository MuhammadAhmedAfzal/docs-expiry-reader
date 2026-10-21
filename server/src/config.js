import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.argv.includes('--memory')
    ? 'memory'
    : process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docs-reader',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  expiryWarningDays: Number(process.env.EXPIRY_WARNING_DAYS) || 30,
  uploadDir: path.resolve(serverRoot, process.env.UPLOAD_DIR || 'uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 20,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  clientDist: path.resolve(serverRoot, '../client/dist'),
  admin: {
    name: process.env.ADMIN_NAME || 'Administrator',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  },
};
