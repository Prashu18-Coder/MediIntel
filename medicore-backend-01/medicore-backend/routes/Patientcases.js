/**
 * Patient Case Routes
 * POST /api/patient-cases       — submit a problem/case (gets Llama-analyzed + stored)
 * GET  /api/patient-cases       — list my cases
 * GET  /api/patient-cases/:id   — get single case with full Llama analysis
 */

const router          = require('express').Router();
const ctrl            = require('../controllers/patientCaseController');
const { protect, optionalAuth } = require('../middleware/auth');

router.post('/',     protect, ctrl.submitCase);
router.get('/',      protect, ctrl.listMyCases);
router.get('/:id',   protect, ctrl.getCase);

module.exports = router;