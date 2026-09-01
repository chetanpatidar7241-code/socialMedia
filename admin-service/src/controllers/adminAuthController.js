const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');
const { sendError } = require('../utils/AppError');

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'username and password are required' });
        }

        const admin = await prisma.admin.findUnique({ where: { username } });
        if (!admin) return res.status(401).json({ message: 'Invalid admin credentials' });

        const isMatch = await bcrypt.compare(password, admin.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid admin credentials' });

        const token = jwt.sign({ role: 'admin', adminId: admin.id, username: admin.username }, process.env.ADMIN_JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (error) {
        sendError(res, error);
    }
};
