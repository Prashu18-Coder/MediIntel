const router = require('express').Router();
const ctrl   = require('../controllers/controllers');
const { protect } = require('../middleware/auth');

router.get('/health-score', ctrl.healthScore);
router.get('/risks',        ctrl.risks);
router.get('/timeline',     ctrl.timeline);

/* ML-powered diabetes risk prediction */
router.post('/diabetes-risk', protect, ctrl.predictDiabetes);

module.exports = router;
