const express = require('express');
const adminAuth = require('../middlewares/adminAuth');
const rankingController = require('../controllers/rankingController');
const { validate } = require('../middlewares/validate');
const { generateRankingsSchema, jobIdParamsSchema } = require('../validators/rankingSchemas');

const router = express.Router();

router.post('/ranking/generate', adminAuth, validate(generateRankingsSchema), rankingController.generateRankings);
router.get('/ranking/jobs/:jobId', adminAuth, validate(jobIdParamsSchema, 'params'), rankingController.getRankingJobStatus);

module.exports = router;
