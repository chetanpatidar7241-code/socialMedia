const express = require('express');
const adminAuth = require('../middlewares/adminAuth');
const rankingController = require('../controllers/rankingController');

const router = express.Router();

router.post('/ranking/generate', adminAuth, rankingController.generateRankings);

module.exports = router;
