const router = require('express').Router();
const ctrl   = require('../controllers/controllers');
const { protect } = require('../middleware/auth');
router.get('/',      protect, ctrl.listRecords);
router.get('/:id',   protect, ctrl.getRecord);
router.post('/',     protect, ctrl.createRecord);
router.put('/:id',   protect, ctrl.updateRecord);
router.delete('/:id',protect, ctrl.deleteRecord);
module.exports = router;
