const express = require('express');
const adminAuth = require('../middlewares/adminAuth');
const winnersController = require('../controllers/winnersController');
const { validate } = require('../middlewares/validate');
const { winnerIdParamsSchema, updateKycBodySchema, listWinnersQuerySchema } = require('../validators/winnerSchemas');

const router = express.Router();

router.get('/winners', adminAuth, validate(listWinnersQuerySchema, 'query'), winnersController.listWinners);
router.get('/winners/history', adminAuth, winnersController.listHistory);
router.post(
    '/winners/:id/kyc',
    adminAuth,
    validate(winnerIdParamsSchema, 'params'),
    validate(updateKycBodySchema),
    winnersController.updateKyc
);

module.exports = router;
