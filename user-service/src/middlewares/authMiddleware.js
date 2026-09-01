const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { sendResponse } = require('../services/CommonService');
const { ResponseMessage } = require('../utils/ResponseMessage');

exports.authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return sendResponse(res, StatusCodes.UNAUTHORIZED, ResponseMessage.NO_TOKEN_PROVIDED);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        sendResponse(res, StatusCodes.UNAUTHORIZED, ResponseMessage.INVALID_TOKEN);
    }
};
