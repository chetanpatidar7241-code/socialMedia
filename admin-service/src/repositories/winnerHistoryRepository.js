const prisma = require('../prismaClient');

// Thin wrapper around prisma.winnerHistory.* — no business logic, only data access.
// See winnerRepository.js for the `client` (optional tx) convention.
function deleteMany(client = prisma) {
    return client.winnerHistory.deleteMany({});
}

function findMany({ orderBy } = {}, client = prisma) {
    return client.winnerHistory.findMany({ orderBy });
}

// userId of everyone who has ever KYC-failed — permanently disqualifies them from
// ever being (re-)allocated a prize, even on a from-scratch regenerate.
function findAllUserIds(client = prisma) {
    return client.winnerHistory.findMany({ select: { userId: true } });
}

function create(data, client = prisma) {
    return client.winnerHistory.create({ data });
}

module.exports = { deleteMany, findMany, findAllUserIds, create };
