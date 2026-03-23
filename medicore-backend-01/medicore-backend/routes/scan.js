/**
 * MediCore — Medicine Scan Routes
 * POST /api/medicine-scan/verify   — Upload image → Groq + ML analysis
 * GET  /api/medicine-scan/         — List past scan results (optional auth)
 * GET  /api/medicine-scan/:id      — Get single scan result by ID
 */

const router          = require('express').Router();
const ctrl            = require('../controllers/controllers');
const upload          = require('../middleware/upload');
const { optionalAuth} = require('../middleware/auth');

/* ── Multer error wrapper ────────────────────────────────────────────────────
   Multer throws synchronously on wrong file type / size.
   express-async-errors does NOT catch these — they need explicit wrapping.
   ──────────────────────────────────────────────────────────────────────── */
function uploadSingle(fieldName) {
  const mw = upload.single(fieldName);
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();

      if (err.code === 'LIMIT_FILE_SIZE')
        return res.status(413).json({
          message: 'File too large. Maximum allowed size is 10 MB.',
          code:    'FILE_TOO_LARGE',
        });

      if (err.code === 'LIMIT_UNEXPECTED_FILE')
        return res.status(400).json({
          message: `Wrong field name "${err.field}". Use "image" as the form field name.`,
          code:    'WRONG_FIELD_NAME',
        });

      if (err.message && err.message.toLowerCase().includes('only'))
        return res.status(415).json({
          message:  'Unsupported file type. Please upload a JPG, PNG, or WebP image of the medicine packaging.',
          code:     'UNSUPPORTED_FILE_TYPE',
          accepted: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        });

      return res.status(400).json({
        message: err.message || 'File upload failed.',
        code:    'UPLOAD_ERROR',
      });
    });
  };
}

/* ── Routes ─────────────────────────────────────────────────────────────── */

// POST /api/medicine-scan/verify
// Body: multipart/form-data, field name: "image"
// Runs: optionalAuth → multer (with error handling) → verifyScan controller
router.post('/verify', optionalAuth, uploadSingle('image'), ctrl.verifyScan);

// GET /api/medicine-scan/
// Returns the authenticated user's scan history (most recent first)
router.get('/', optionalAuth, ctrl.listScans);

// GET /api/medicine-scan/:id
// Returns a single scan result by MongoDB _id
router.get('/:id', optionalAuth, ctrl.getScan);

module.exports = router;