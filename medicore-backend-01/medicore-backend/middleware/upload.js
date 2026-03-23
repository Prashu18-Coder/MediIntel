const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

// Accept by extension only — MIME types vary wildly by OS/browser for CSV
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const ok  = ['.pdf','.csv','.jpg','.jpeg','.png','.gif','.webp','.bmp'].includes(ext);
  if (ok) return cb(null, true);
  cb(new Error('Unsupported file. Upload PDF, CSV, JPG or PNG.'));
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });