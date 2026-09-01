const { StatusCodes } = require('http-status-codes');
const { sendResponse } = require('../services/CommonService');
const { ResponseMessage } = require('../utils/ResponseMessage');

// Guards the internal API the Admin Service consumes. Without this, anyone who can
// reach the User Service on the network could read every user's residency and post data.
module.exports = function internalAuth(req, res, next) {
    const providedKey = req.headers['x-internal-api-key'];
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey) {
        console.error('INTERNAL_API_KEY is not configured; refusing internal request.');
        return sendResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, ResponseMessage.INTERNAL_API_NOT_CONFIGURED);
    }
    if (!providedKey || providedKey !== expectedKey) {
        return sendResponse(res, StatusCodes.UNAUTHORIZED, ResponseMessage.UNAUTHORIZED);
    }
    next();
};
