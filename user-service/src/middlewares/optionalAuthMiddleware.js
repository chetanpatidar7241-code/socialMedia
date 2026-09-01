const jwt = require('jsonwebtoken');

// For public routes that behave differently when a valid caller is known (e.g. "did
// I already like this post") but must not fail for anonymous/expired-token requests.
// Unlike `authenticate`, an invalid or missing token here just means "treat as anonymous."
module.exports = function optionalAuthenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        // Invalid/expired token on a public route — proceed as anonymous.
    }
    next();
};
