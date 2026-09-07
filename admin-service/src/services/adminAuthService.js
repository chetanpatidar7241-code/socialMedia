const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const adminRepository = require('../repositories/adminRepository');
const { AppError } = require('../utils/AppError');

// Shape validation (both fields required, non-empty strings) already ran in
// validate(loginSchema) at the route level (see routes/adminAuthRoutes.js).
async function login({ username, password }) {
    const admin = await adminRepository.findByUsername(username);
    if (!admin) throw new AppError(401, 'Invalid admin credentials');

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) throw new AppError(401, 'Invalid admin credentials');

    const token = jwt.sign(
        { role: 'admin', adminId: admin.id, username: admin.username },
        config.adminJwtSecret,
        { expiresIn: '1d' }
    );
    return { token };
}

module.exports = { login };
