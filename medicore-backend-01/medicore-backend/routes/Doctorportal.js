/**
 * Doctor Portal Routes
 */
const router = require('express').Router();
const ctrl   = require('../controllers/Doctorportalcontroller');
const { protect } = require('../middleware/auth');

router.get ('/profile',              protect, ctrl.getDoctorProfile);
router.put ('/profile',              protect, ctrl.updateDoctorProfile);
router.get ('/recommendations',      protect, ctrl.getPatientRecommendations);
router.get ('/my-patients',          protect, ctrl.getMyPatients);
router.get ('/patient/:userId',      protect, ctrl.getPatientProfile);
router.get ('/appointments',         protect, ctrl.getDoctorAppointments);
router.put ('/appointments/:id',     protect, ctrl.updateAppointment);
router.post('/prioritize',           protect, ctrl.reprioritizePatients);
router.post('/review-case',          protect, ctrl.reviewCase);
router.get ('/analytics',            protect, ctrl.getAnalytics);
router.get ('/stats',                protect, ctrl.getDoctorStats);

module.exports = router;