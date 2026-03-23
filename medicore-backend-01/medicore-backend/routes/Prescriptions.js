/**
 * Prescription Routes
 * POST   /api/prescriptions              — doctor creates prescription
 * GET    /api/prescriptions              — doctor lists their prescriptions
 * GET    /api/prescriptions/my           — patient views their prescriptions
 * GET    /api/prescriptions/:id          — get single prescription
 * PUT    /api/prescriptions/:id          — doctor updates prescription
 * DELETE /api/prescriptions/:id          — doctor deletes prescription
 */
const router = require('express').Router();
const ctrl   = require('../controllers/prescriptionController');
const { protect } = require('../middleware/auth');

router.post('/',        protect, ctrl.createPrescription);
router.get('/my',       protect, ctrl.myPrescriptions);
router.get('/',         protect, ctrl.listDoctorPrescriptions);
router.get('/:id',      protect, ctrl.getPrescription);
router.put('/:id',      protect, ctrl.updatePrescription);
router.delete('/:id',   protect, ctrl.deletePrescription);

module.exports = router;