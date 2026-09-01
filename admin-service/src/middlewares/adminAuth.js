const jwt = require('jsonwebtoken');

module.exports = function adminAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
        req.admin = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};
