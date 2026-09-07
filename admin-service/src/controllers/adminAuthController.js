const { sendError } = require('../utils/AppError');
const adminAuthService = require('../services/adminAuthService');

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await adminAuthService.login({ username, password });
        res.json(result);
    } catch (error) {
        sendError(res, error);
    }
};
