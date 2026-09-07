const jwt = require('jsonwebtoken');

function extractBearerToken(req) {
    return req.headers.authorization?.split(' ')[1];
}

// Required-auth factory: extracts a Bearer token, verifies it against `secret`, and
// attaches the decoded payload to req[attachAs]. Deliberately does NOT decide how to
// respond on failure — `onMissingToken`/`onInvalidToken` are supplied by the caller,
// so each service keeps its own response contract (shape, status code, wording)
// instead of this shared module dictating one. `secret` is always the caller's own
// (JWT_SECRET vs ADMIN_JWT_SECRET) — this factory never mixes the two, so a token
// signed for one service's routes fails verification against the other's.
function createAuthMiddleware({ secret, attachAs = 'user', onMissingToken, onInvalidToken }) {
    if (!secret) throw new Error('createAuthMiddleware requires a secret');
    if (typeof onMissingToken !== 'function' || typeof onInvalidToken !== 'function') {
        throw new Error('createAuthMiddleware requires onMissingToken and onInvalidToken callbacks');
    }

    return (req, res, next) => {
        const token = extractBearerToken(req);
        if (!token) return onMissingToken(req, res, next);

        try {
            req[attachAs] = jwt.verify(token, secret);
            next();
        } catch (error) {
            onInvalidToken(req, res, next, error);
        }
    };
}

// Optional-auth factory: for public routes that behave differently when a valid
// caller is known (e.g. "did I already like this post") but must never fail for
// anonymous/expired-token requests — missing or invalid token just means "proceed
// as anonymous," so there is nothing for a caller to customize here.
function createOptionalAuthMiddleware({ secret, attachAs = 'user' }) {
    if (!secret) throw new Error('createOptionalAuthMiddleware requires a secret');

    return (req, res, next) => {
        const token = extractBearerToken(req);
        if (!token) return next();

        try {
            req[attachAs] = jwt.verify(token, secret);
        } catch {
            // Invalid/expired token on a public route — proceed as anonymous.
        }
        next();
    };
}

module.exports = { createAuthMiddleware, createOptionalAuthMiddleware };
