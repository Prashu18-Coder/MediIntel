const router = require('express').Router();
const ctrl   = require('../controllers/controllers');
const { protect, optionalAuth } = require('../middleware/auth');

router.post('/', protect,      ctrl.bookAppointment);
router.get('/',  optionalAuth, ctrl.listAppointments);
module.exports = router;