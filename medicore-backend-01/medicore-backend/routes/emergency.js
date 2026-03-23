const router = require('express').Router();
const ctrl   = require('../controllers/controllers');
const { optionalAuth } = require('../middleware/auth');
router.post('/trigger', optionalAuth, ctrl.triggerAlert);
router.get('/history',  optionalAuth, ctrl.alertHistory);
module.exports = router;
