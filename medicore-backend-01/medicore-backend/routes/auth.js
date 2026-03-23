/**
 * Auth Routes — /api/auth
 */
const router = require('express').Router();
const ctrl   = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register',     ctrl.register);
router.post('/login',        ctrl.login);
router.post('/logout',       ctrl.logout);
router.get ('/me',           protect, ctrl.me);
router.post('/google',       ctrl.googleAuth);

module.exports = router;