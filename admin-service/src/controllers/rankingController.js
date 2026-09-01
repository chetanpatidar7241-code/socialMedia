const { sendError } = require('../utils/AppError');
const winnerService = require('../services/winnerService');

exports.generateRankings = async (req, res) => {
    try {
        const force = req.body?.force === true;
        const winners = await winnerService.generateInitialRankings({ force });
        res.status(201).json({ message: 'Rankings generated', winners });
    } catch (error) {
        sendError(res, error);
    }
};
