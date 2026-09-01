const { computeGlobalRanking, computeConsistencyRanking, computeCategoryRankings } = require('./rankingCalculations');
const { TIERS } = require('../constants');

function findReplacement({ tier, category, posts, consistency, excludeUserIds }) {
    let candidates;

    switch (tier) {
        case TIERS.GRAND_PRIZE:
        case TIERS.TOP_PERFORMER:
            candidates = computeGlobalRanking(posts);
            break;
        case TIERS.CONSISTENCY_1:
        case TIERS.CONSISTENCY_2:
            candidates = computeConsistencyRanking(consistency).map((c) => ({ userId: c.userId, score: c.totalConsistencyScore }));
            break;
        case TIERS.CATEGORY_1:
        case TIERS.CATEGORY_2:
            candidates = computeCategoryRankings(posts)[category] || [];
            break;
        default:
            throw new Error(`Unknown tier: ${tier}`);
    }

    const next = candidates.find((c) => !excludeUserIds.has(c.userId));
    return next ? { userId: next.userId, score: next.score } : null;
    // Returning null is the "category exhausted / no one left" case — the caller must
    // leave the slot unawarded rather than backfilling from an unrelated category or tier.
}

module.exports = { findReplacement };
