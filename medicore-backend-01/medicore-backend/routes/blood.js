const router          = require('express').Router();
const ctrl            = require('../controllers/controllers');
const { optionalAuth} = require('../middleware/auth');

// GET  /api/blood/search?blood_group=O+&city=Hyderabad
router.get('/search',    ctrl.searchDonors);

// POST /api/blood/register
router.post('/register', optionalAuth, ctrl.registerDonor);

// GET  /api/blood/donors
router.get('/donors', ctrl.listDonors);

module.exports = router;