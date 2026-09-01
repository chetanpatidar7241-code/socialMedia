const { StatusCodes } = require('http-status-codes');
const { sendResponse } = require('../services/CommonService');
const { ResponseMessage } = require('../utils/ResponseMessage');

// Minimal in-memory fixed-window limiter (no extra dependency) to blunt brute-force /
// credential-stuffing against auth endpoints. Not distributed-safe — fine for a single
// instance; swap for a Redis-backed limiter (e.g. rate-limiter-flexible) if scaled horizontally.
function rateLimit({ windowMs, max }) {
    const hits = new Map(); // key -> { count, resetAt }

    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        let entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;

        if (entry.count > max) {
            const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
            res.set('Retry-After', String(retryAfterSec));
            return sendResponse(res, StatusCodes.TOO_MANY_REQUESTS, ResponseMessage.TOO_MANY_REQUESTS);
        }
        next();
    };
}

module.exports = { rateLimit };
