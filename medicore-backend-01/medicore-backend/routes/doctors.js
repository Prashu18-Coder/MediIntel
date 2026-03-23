const router = require('express').Router();
const ctrl   = require('../controllers/controllers');
router.get('/', ctrl.listDoctors);
module.exports = router;
