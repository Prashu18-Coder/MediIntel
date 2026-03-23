const router = require('express').Router();
const ctrl   = require('../controllers/controllers');
const { optionalAuth } = require('../middleware/auth');
router.post('/analyze',          optionalAuth, ctrl.analyzeSymptoms);
router.get('/suggestions',       ctrl.getSymptomSuggestions);
module.exports = router;
