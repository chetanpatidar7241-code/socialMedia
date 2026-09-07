const config = require('./src/config/env');

const app = require('./src/app');
const prisma = require('./src/prismaClient');
const bcrypt = require('bcryptjs');

const PORT = config.port;

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
