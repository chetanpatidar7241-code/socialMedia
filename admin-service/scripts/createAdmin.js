// One-off CLI to create an admin account. Deliberately not an HTTP endpoint — an
// open "create admin" route would let anyone hand themselves admin access.
// Usage: node scripts/createAdmin.js <username> <password>
const bcrypt = require('bcryptjs');
// prismaClient requires src/config/env.js, which loads and validates .env — no need
// to call dotenv.config() again here.
const prisma = require('../src/prismaClient');

async function main() {
    const [username, password] = process.argv.slice(2);
    if (!username || !password) {
        console.error('Usage: node scripts/createAdmin.js <username> <password>');
        process.exit(1);
    }
    if (password.length < 6) {
        console.error('Password must be at least 6 characters');
        process.exit(1);
    }

    const existing = await prisma.admin.findUnique({ where: { username } });
    if (existing) {
        console.error(`Admin "${username}" already exists.`);
        process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({ data: { username, passwordHash } });
    console.log(`Admin account created: ${admin.username} (id ${admin.id})`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
