const prisma = require('../prismaClient');

// Thin wrapper around prisma.winner.* — no business logic, only data access.
// Every function accepts an optional `client` (a prisma.$transaction callback's `tx`)
// so the transactional orchestration in winnerService keeps working unchanged;
// it defaults to the singleton client for reads that don't need a transaction.
function count(client = prisma) {
    return client.winner.count();
}

function deleteMany(client = prisma) {
    return client.winner.deleteMany({});
}

function createMany(data, client = prisma) {
    return client.winner.createMany({ data });
}

function findMany({ where = {}, orderBy } = {}, client = prisma) {
    return client.winner.findMany({ where, orderBy });
}

function findById(id, client = prisma) {
    return client.winner.findUnique({ where: { id } });
}

function deleteById(id, client = prisma) {
    return client.winner.delete({ where: { id } });
}

function create(data, client = prisma) {
    return client.winner.create({ data });
}

function updateKycStatus(id, kycStatus, client = prisma) {
    return client.winner.update({ where: { id }, data: { kycStatus } });
}

// userId of every currently-active winner — used to build the cascade's
// excludeUserIds set (a person can't hold two active prizes).
function findAllUserIds(client = prisma) {
    return client.winner.findMany({ select: { userId: true } });
}

module.exports = { count, deleteMany, createMany, findMany, findById, deleteById, create, updateKycStatus, findAllUserIds };
