const { StatusCodes } = require('http-status-codes');
const { sendResponse } = require('../services/CommonService');
const { ResponseMessage } = require('./ResponseMessage');

// Errors constructed with a statusCode carry a message that is SAFE to show to the
// client (validation failures, 404s, conflicts). Anything without one is treated as
// an unexpected internal failure: logged in full server-side, never echoed to the client.
class AppError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

function sendError(res, err) {
    if (err.statusCode) {
        return sendResponse(res, err.statusCode, err.message);
    }
    console.error(err);
    return sendResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, ResponseMessage.INTERNAL_SERVER_ERROR);
}

module.exports = { AppError, sendError };
