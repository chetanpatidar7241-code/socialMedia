const { sendError } = require('../utils/AppError');
const winnerService = require('../services/winnerService');
const rankingQueue = require('../queue/rankingQueue');

exports.generateRankings = async (req, res) => {
    try {
        // force shape/default already handled by validate(generateRankingsSchema).
        const { force } = req.body;

        // Fast-fail 409 before touching the queue at all, instead of returning 202
        // and making the caller poll just to discover the job failed for a reason
        // that was already knowable synchronously.
        await winnerService.assertRankingsNotYetGenerated({ force });

        const jobId = await rankingQueue.enqueueGenerate({ force });
        res.status(202).json({ message: 'Ranking generation queued', jobId });
    } catch (error) {
        sendError(res, error);
    }
};

// GET /api/ranking/jobs/:jobId — lets the Admin Dashboard poll a queued
// generate/KYC-cascade job until it completes or fails.
exports.getRankingJobStatus = async (req, res) => {
    try {
        const status = await rankingQueue.getJobStatus(req.params.jobId);
        if (!status) return res.status(404).json({ message: 'Job not found' });
        res.json(status);
    } catch (error) {
        sendError(res, error);
    }
};
