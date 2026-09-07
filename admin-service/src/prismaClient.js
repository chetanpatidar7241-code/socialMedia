const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const config = require('./config/env');

// Prisma 7 requires an explicit driver adapter — `new PrismaClient()` with no
// arguments throws at construction time.
const adapter = new PrismaPg({ connectionString: config.databaseUrl });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
