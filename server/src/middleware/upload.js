import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../utils/http.js';

fs.mkdirSync(config.uploadDir, { recursive: true });

const ALLOWED_DOCUMENT_TYPES = [
  /^image\//,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\./,
  /^application\/vnd\.ms-excel$/,
  /^text\/plain$/,
];

export const documentUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOCUMENT_TYPES.some((pattern) => pattern.test(file.mimetype))) return cb(null, true);
    cb(new HttpError(400, 'Only images, PDF, Word, Excel and text files can be uploaded'));
  },
});

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.csv$/i.test(file.originalname)) return cb(null, true);
    cb(new HttpError(400, 'Please upload a .csv file'));
  },
});

export function storedFileInfo(file) {
  if (!file) return undefined;
  return { filename: file.filename, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
}

export function removeStoredFile(filename) {
  if (!filename) return;
  fs.promises.unlink(path.join(config.uploadDir, filename)).catch(() => {});
}
