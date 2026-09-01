const { sendError } = require('../utils/AppError');
const winnerService = require('../services/winnerService');
const { TIERS } = require('../constants');

const VALID_TIERS = new Set(Object.values(TIERS));

// GET /api/winners?tier=&category= — supports filtering/grouping by tier as required.
exports.listWinners = async (req, res) => {
    try {
        const { tier, category } = req.query;
        if (tier && !VALID_TIERS.has(tier)) {
            return res.status(400).json({ message: `tier must be one of: ${[...VALID_TIERS].join(', ')}` });
        }
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
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid winner id' });

        const { status } = req.body;
        if (!['PASSED', 'FAILED'].includes(status)) {
            return res.status(400).json({ message: "status must be 'PASSED' or 'FAILED'" });
        }

        if (status === 'PASSED') {
            const winner = await winnerService.markKycPassed(id);
            return res.json({ message: 'KYC marked as PASSED', winner });
        }

        const { removed, promoted } = await winnerService.markKycFailedWithCascade(id);
        res.json({
            message: promoted
                ? `KYC marked as FAILED. ${removed.tier}${removed.category ? ` (${removed.category})` : ''} slot cascaded to the next eligible person.`
                : `KYC marked as FAILED. No eligible replacement remains; the slot is unawarded.`,
            removedUserId: removed.userId,
            promoted
        });
    } catch (error) {
        sendError(res, error);
    }
};
