const express = require('express');
const adminAuth = require('../middlewares/adminAuth');
const winnersController = require('../controllers/winnersController');

const router = express.Router();

router.get('/winners', adminAuth, winnersController.listWinners);
router.get('/winners/history', adminAuth, winnersController.listHistory);
router.post('/winners/:id/kyc', adminAuth, winnersController.updateKyc);

module.exports = router;
