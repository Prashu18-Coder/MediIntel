const router = require('express').Router();
const ctrl   = require('../controllers/controllers');
const upload = require('../middleware/upload');
const { optionalAuth } = require('../middleware/auth');
router.post('/upload', optionalAuth, upload.single('report'), ctrl.uploadReport);
router.get('/',        optionalAuth, ctrl.listReports);
router.get('/:id',     optionalAuth, ctrl.getReport);
module.exports = router;
