const { createAuthMiddleware } = require('@internal/shared-auth');
const config = require('../config/env');

// Token-verification mechanics live in the shared module; this service's own secret
// and response contract stay here — an admin token is verified against
// ADMIN_JWT_SECRET only, never JWT_SECRET, so a user token can never pass here.
module.exports = createAuthMiddleware({
    secret: config.adminJwtSecret,
    attachAs: 'admin',
    onMissingToken: (req, res) => res.status(401).json({ message: 'Unauthorized' }),
    onInvalidToken: (req, res) => res.status(401).json({ message: 'Invalid or expired token' })
});
