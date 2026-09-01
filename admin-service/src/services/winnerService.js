const prisma = require('../prismaClient');
const { fetchRankingData, fetchUsernames } = require('./userServiceClient');
const { allocatePrizes } = require('../ranking/allocatePrizes');
const { findReplacement } = require('../ranking/findReplacement');
const { AppError } = require('../utils/AppError');
const { Prisma } = require('@prisma/client');

const MAX_CASCADE_RETRIES = 5;

// Generating rankings is a rare, deliberate admin action (lock in the initial 33
// prizes) — not something that should silently re-run and re-litigate every time
// someone asks for it. Once winners exist, cascades (KYC failures) are the only way
// slots change; a caller must explicitly pass force:true to wipe everything and start
// over, which is why this guards on existing rows instead of always recomputing.
async function generateInitialRankings({ force = false } = {}) {
    const existingCount = await prisma.winner.count();
    if (existingCount > 0 && !force) {
        throw new AppError(409, 'Rankings have already been generated. Pass force=true to fully regenerate (this discards all current winners and history).');
    }

    const { posts, consistency } = await fetchRankingData();

    return prisma.$transaction(async (tx) => {
        if (force) {
            await tx.winner.deleteMany({});
            await tx.winnerHistory.deleteMany({});
        }

        const disqualifiedUserIds = new Set((await tx.winnerHistory.findMany({ select: { userId: true } })).map((h) => h.userId));
        const winners = allocatePrizes(posts, consistency, disqualifiedUserIds);

        if (winners.length > 0) {
            await tx.winner.createMany({
                data: winners.map((w) => ({ userId: w.userId, tier: w.tier, category: w.category, score: w.score, kycStatus: 'PENDING' }))
            });
        }

        return tx.winner.findMany({ orderBy: [{ tier: 'asc' }, { category: 'asc' }] });
    });
}

// Enriches winner rows with the display username the User Service owns. If the User
// Service is unreachable, the table still renders (with just the userId) rather than
// failing the whole request over a display-only field.
async function withUsernames(winners) {
    let usersById = {};
    try {
        usersById = await fetchUsernames(winners.map((w) => w.userId));
    } catch (err) {
        console.error('Failed to resolve usernames for winners list:', err.message);
    }
    return winners.map((w) => ({ ...w, username: usersById[w.userId]?.username ?? null }));
}

async function listWinners({ tier, category } = {}) {
    const winners = await prisma.winner.findMany({
        where: {
            ...(tier ? { tier } : {}),
            ...(category ? { category } : {})
        },
        orderBy: [{ tier: 'asc' }, { category: 'asc' }, { score: 'desc' }]
    });
    return withUsernames(winners);
}

async function listHistory() {
    return prisma.winnerHistory.findMany({ orderBy: { decidedAt: 'desc' } });
}

async function markKycPassed(winnerId) {
    try {
        return await prisma.winner.update({ where: { id: winnerId }, data: { kycStatus: 'PASSED' } });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new AppError(404, 'Winner not found');
        }
        throw err;
    }
}

// Marks a winner's KYC as FAILED, removes them from the active winners table, and
// promotes the next eligible candidate into the SAME slot (same tier/category) —
// never touching any other slot. If that promoted candidate later fails too, calling
// this again on their (new) winner id repeats the process, so chains resolve one
// failure at a time rather than needing special-cased "chain" logic.
async function markKycFailedWithCascade(winnerId) {
    const { posts, consistency } = await fetchRankingData();

    for (let attempt = 0; attempt < MAX_CASCADE_RETRIES; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                const winner = await tx.winner.findUnique({ where: { id: winnerId } });
                if (!winner) throw new AppError(404, 'Winner not found');

                await tx.winner.delete({ where: { id: winnerId } });

                const [activeWinners, history] = await Promise.all([
                    tx.winner.findMany({ select: { userId: true } }),
                    tx.winnerHistory.findMany({ select: { userId: true } })
                ]);
                const excludeUserIds = new Set([
                    ...activeWinners.map((w) => w.userId),
                    ...history.map((h) => h.userId),
                    winner.userId
                ]);

                const replacement = findReplacement({
                    tier: winner.tier,
                    category: winner.category,
                    posts,
                    consistency,
                    excludeUserIds
                });

                await tx.winnerHistory.create({
                    data: {
                        userId: winner.userId,
                        tier: winner.tier,
                        category: winner.category,
                        score: winner.score,
                        outcome: 'KYC_FAILED',
                        replacedByUserId: replacement?.userId ?? null
                    }
                });

                let newWinner = null;
                if (replacement) {
                    // Unique constraint on Winner.userId is the last line of defense: if a
                    // concurrent cascade elsewhere already claimed this same person for a
                    // different slot, this insert throws P2002 and we retry from scratch
                    // below instead of ever letting one person hold two prizes.
                    newWinner = await tx.winner.create({
                        data: { userId: replacement.userId, tier: winner.tier, category: winner.category, score: replacement.score, kycStatus: 'PENDING' }
                    });
                }

                return { removed: winner, promoted: newWinner };
            });
        } catch (err) {
            const isUniqueRace = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
            if (!isUniqueRace || attempt === MAX_CASCADE_RETRIES - 1) throw err;
            // Someone else's concurrent cascade won the race for the same candidate;
            // loop and recompute the next-best replacement against the now-updated state.
        }
    }
    throw new AppError(409, 'Could not resolve KYC cascade due to concurrent updates; please retry');
}

module.exports = { generateInitialRankings, listWinners, listHistory, markKycPassed, markKycFailedWithCascade };
