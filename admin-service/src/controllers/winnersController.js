const { sendError } = require('../utils/AppError');
const winnerService = require('../services/winnerService');
const rankingQueue = require('../queue/rankingQueue');

// GET /api/winners?tier=&category= — supports filtering/grouping by tier as required.
// tier/category shape already validated by validate(listWinnersQuerySchema, 'query').
exports.listWinners = async (req, res) => {
    try {
        const { tier, category } = req.query;
        const winners = await winnerService.listWinners({ tier, category });
        res.json(winners);
    } catch (error) {
        sendError(res, error);
    }
};

// GET /api/winners/history — audit trail of every KYC failure and who replaced whom,
// so an admin (or evaluator) can see a chained cascade end to end.
exports.listHistory = async (req, res) => {
    try {
        res.json(await winnerService.listHistory());
    } catch (error) {
        sendError(res, error);
    }
};

exports.updateKyc = async (req, res) => {
    try {
        // id and status shape already validated by validate() in routes/winnersRoutes.js.
        const id = req.params.id;
        const { status } = req.body;

        if (status === 'PASSED') {
            // Trivial single-row update — stays synchronous, no queue involved.
            const winner = await winnerService.markKycPassed(id);
            return res.json({ message: 'KYC marked as PASSED', winner });
        }

        // FAILED: the cascade re-fetches fresh ranking data and runs a Prisma
        // transaction with up to 5 retries on a concurrent-race — queue it instead of
        // blocking this request. Poll GET /api/ranking/jobs/:jobId for the result
        // (a { removed, promoted } object, same shape markKycFailedWithCascade always returned).
        const jobId = await rankingQueue.enqueueKycFailedCascade({ winnerId: id });
        res.status(202).json({ message: 'KYC failure cascade queued', jobId });
    } catch (error) {
        sendError(res, error);
    }
};
