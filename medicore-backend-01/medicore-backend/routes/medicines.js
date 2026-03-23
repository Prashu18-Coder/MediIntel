const router = require('express').Router();
const ctrl   = require('../controllers/controllers');
const { protect } = require('../middleware/auth');
router.get('/',            protect, ctrl.listMedicines);
router.post('/',           protect, ctrl.addMedicine);
router.put('/:id',         protect, ctrl.updateMedicine);
router.put('/:id/toggle',  protect, ctrl.toggleMedicine);
router.delete('/:id',      protect, ctrl.deleteMedicine);
module.exports = router;
