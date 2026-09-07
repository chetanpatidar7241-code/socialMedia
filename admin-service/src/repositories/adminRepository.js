const prisma = require('../prismaClient');

// Thin wrapper around prisma.admin.* — no business logic, only data access.
function findByUsername(username, client = prisma) {
    return client.admin.findUnique({ where: { username } });
}

module.exports = { findByUsername };
