const { StatusCodes } = require('http-status-codes');
const { createAuthMiddleware } = require('@internal/shared-auth');
const config = require('../config/env');
const { sendResponse } = require('../services/CommonService');
const { ResponseMessage } = require('../utils/ResponseMessage');

// Token-verification mechanics (extract Bearer token, jwt.verify, attach to req) live
// in the shared module; this service's own secret and response contract stay here —
// a user token is verified against JWT_SECRET only, never ADMIN_JWT_SECRET.
exports.authenticate = createAuthMiddleware({
    secret: config.jwtSecret,
    attachAs: 'user',
    onMissingToken: (req, res) => sendResponse(res, StatusCodes.UNAUTHORIZED, ResponseMessage.NO_TOKEN_PROVIDED),
    onInvalidToken: (req, res) => sendResponse(res, StatusCodes.UNAUTHORIZED, ResponseMessage.INVALID_TOKEN)
});
