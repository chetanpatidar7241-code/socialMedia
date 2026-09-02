require('dotenv').config();

['DATABASE_URL', 'ADMIN_JWT_SECRET', 'INTERNAL_API_KEY'].forEach((key) => {
    if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
});

const app = require('./src/app');
const prisma = require('./src/prismaClient');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // Auto-create default admin
        const existingAdmin = await prisma.admin.findUnique({ where: { username: 'admin' } });
        if (!existingAdmin) {
            const passwordHash = await bcrypt.hash('Admin@123', 10);
            await prisma.admin.create({
                data: {
                    username: 'admin',
                    passwordHash: passwordHash
                }
            });
            console.log('Default admin (username: admin) created successfully.');
        } else {
            console.log('Default admin already exists.');
        }
    } catch (error) {
        console.error('Error checking/creating default admin:', error);
    }

    app.listen(PORT, () => console.log(`Admin service on port ${PORT}`));
}

startServer();
