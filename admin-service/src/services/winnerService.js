const prisma = require('../prismaClient');
const { fetchRankingData, fetchUsernames } = require('./userServiceClient');
const { allocatePrizes } = require('../ranking/allocatePrizes');
const { findReplacement } = require('../ranking/findReplacement');
const { AppError } = require('../utils/AppError');
const { Prisma } = require('@prisma/client');
const winnerRepository = require('../repositories/winnerRepository');
const winnerHistoryRepository = require('../repositories/winnerHistoryRepository');

const MAX_CASCADE_RETRIES = 5;

// Generating rankings is a rare, deliberate admin action (lock in the initial 33
// prizes) — not something that should silently re-run and re-litigate every time
// someone asks for it. Once winners exist, cascades (KYC failures) are the only way
// slots change; a caller must explicitly pass force:true to wipe everything and start
// over, which is why this guards on existing rows instead of always recomputing.
// Extracted so the controller can run this same check synchronously BEFORE
// enqueueing a ranking job (fast-fail 409 instead of "202, then poll to discover a
// 409") — generateInitialRankings still runs it again itself below, since a job can
// sit in the queue for a moment and the guard must hold at execution time, not just
// at enqueue time.
async function assertRankingsNotYetGenerated({ force = false } = {}) {
    const existingCount = await winnerRepository.count();
    if (existingCount > 0 && !force) {
        throw new AppError(409, 'Rankings have already been generated. Pass force=true to fully regenerate (this discards all current winners and history).');
    }
}

async function generateInitialRankings({ force = false } = {}) {
    await assertRankingsNotYetGenerated({ force });

    const { posts, consistency } = await fetchRankingData();

    return prisma.$transaction(async (tx) => {
        if (force) {
            await winnerRepository.deleteMany(tx);
            await winnerHistoryRepository.deleteMany(tx);
        }

        const historyUserIds = await winnerHistoryRepository.findAllUserIds(tx);
        const disqualifiedUserIds = new Set(historyUserIds.map((h) => h.userId));
        const winners = allocatePrizes(posts, consistency, disqualifiedUserIds);

        if (winners.length > 0) {
            await winnerRepository.createMany(
                winners.map((w) => ({ userId: w.userId, tier: w.tier, category: w.category, score: w.score, kycStatus: 'PENDING' })),
                tx
            );
        }

        return winnerRepository.findMany({ orderBy: [{ tier: 'asc' }, { category: 'asc' }] }, tx);
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
    const winners = await winnerRepository.findMany({
        where: {
            ...(tier ? { tier } : {}),
            ...(category ? { category } : {})
        },
        orderBy: [{ tier: 'asc' }, { category: 'asc' }, { score: 'desc' }]
    });
    return withUsernames(winners);
}

async function listHistory() {
    return winnerHistoryRepository.findMany({ orderBy: { decidedAt: 'desc' } });
}

async function markKycPassed(winnerId) {
    try {
        return await winnerRepository.updateKycStatus(winnerId, 'PASSED');
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
                const winner = await winnerRepository.findById(winnerId, tx);
                if (!winner) throw new AppError(404, 'Winner not found');

                await winnerRepository.deleteById(winnerId, tx);

                const [activeWinners, history] = await Promise.all([
                    winnerRepository.findAllUserIds(tx),
                    winnerHistoryRepository.findAllUserIds(tx)
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

                await winnerHistoryRepository.create({
                    userId: winner.userId,
                    tier: winner.tier,
                    category: winner.category,
                    score: winner.score,
                    outcome: 'KYC_FAILED',
                    replacedByUserId: replacement?.userId ?? null
                }, tx);

                let newWinner = null;
                if (replacement) {
                    // Unique constraint on Winner.userId is the last line of defense: if a
                    // concurrent cascade elsewhere already claimed this same person for a
                    // different slot, this insert throws P2002 and we retry from scratch
                    // below instead of ever letting one person hold two prizes.
                    newWinner = await winnerRepository.create({
                        userId: replacement.userId,
                        tier: winner.tier,
                        category: winner.category,
                        score: replacement.score,
                        kycStatus: 'PENDING'
                    }, tx);
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

module.exports = {
    generateInitialRankings,
    assertRankingsNotYetGenerated,
    listWinners,
    listHistory,
    markKycPassed,
    markKycFailedWithCascade
};
