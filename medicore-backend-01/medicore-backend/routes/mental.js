const router = require('express').Router();
const ctrl   = require('../controllers/controllers');
const { optionalAuth } = require('../middleware/auth');
router.post('/chat',        ctrl.chat);
router.post('/mood',        optionalAuth, ctrl.logMood);
router.get('/mood/history', optionalAuth, ctrl.moodHistory);
module.exports = router;
