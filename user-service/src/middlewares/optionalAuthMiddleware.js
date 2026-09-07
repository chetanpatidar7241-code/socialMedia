const { createOptionalAuthMiddleware } = require('@internal/shared-auth');
const config = require('../config/env');

// For public routes that behave differently when a valid caller is known (e.g. "did
// I already like this post") but must not fail for anonymous/expired-token requests.
module.exports = createOptionalAuthMiddleware({ secret: config.jwtSecret, attachAs: 'user' });
