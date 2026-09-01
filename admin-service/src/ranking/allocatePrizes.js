const { compareByScore } = require('./tieBreak');
const { computeGlobalRanking, computeConsistencyRanking, computeCategoryRankings } = require('./rankingCalculations');
const { TIERS, CATEGORIES } = require('../constants');

// Allocates all 33 prizes from scratch, strictly in priority order, one prize per
// person (once won, excluded from every later tier). `disqualifiedUserIds` lets a
// KYC-failed user be excluded even on a from-scratch run (e.g. rebuilding history).
function allocatePrizes(posts, consistency, disqualifiedUserIds = new Set()) {
    const globalRanking = computeGlobalRanking(posts).filter((p) => !disqualifiedUserIds.has(p.userId));
    const consistencyRanking = computeConsistencyRanking(consistency).filter((c) => !disqualifiedUserIds.has(c.userId));
    const categoryRankings = computeCategoryRankings(posts);

    const wonUserIds = new Set();
    const winners = [];

    const claim = (userId) => wonUserIds.add(userId);
    const isFree = (userId) => !wonUserIds.has(userId) && !disqualifiedUserIds.has(userId);

    // 1. Grand Prize
    const grandPrizeWinner = globalRanking.find((p) => isFree(p.userId));
    if (grandPrizeWinner) {
        winners.push({ userId: grandPrizeWinner.userId, tier: TIERS.GRAND_PRIZE, category: null, score: grandPrizeWinner.score });
        claim(grandPrizeWinner.userId);
    }

    // 2 & 3. Consistency 1st / 2nd
    const consistencyTiers = [TIERS.CONSISTENCY_1, TIERS.CONSISTENCY_2];
    for (const tier of consistencyTiers) {
        const winner = consistencyRanking.find((c) => isFree(c.userId));
        if (!winner) continue;
        winners.push({ userId: winner.userId, tier, category: null, score: winner.totalConsistencyScore });
        claim(winner.userId);
    }

    // 4. Top Performers (10 distinct people), drawn from the same global best-post ranking.
    let topPerformerCount = 0;
    for (const p of globalRanking) {
        if (topPerformerCount >= 10) break;
        if (!isFree(p.userId)) continue;
        winners.push({ userId: p.userId, tier: TIERS.TOP_PERFORMER, category: null, score: p.score });
        claim(p.userId);
        topPerformerCount++;
    }

    // 5 & 6. Category 1st / 2nd. Candidates are walked in GLOBAL score order across all
    // categories so that a person leading 2+ categories is assigned to whichever slot
    // they reach first (their single strongest category) — by the time their weaker
    // category's post is reached in this walk, `wonUserIds` already excludes them, so
    // that category's slot naturally cascades to the next-best remaining person.
    const allCategoryPosts = CATEGORIES.flatMap((cat) => categoryRankings[cat] || []).sort(compareByScore);
    const categorySlots = new Map(CATEGORIES.map((cat) => [cat, { 1: null, 2: null }]));

    for (const p of allCategoryPosts) {
        if (!isFree(p.userId)) continue;
        const slots = categorySlots.get(p.category);
        if (!slots[1]) {
            slots[1] = p;
            claim(p.userId);
        } else if (!slots[2]) {
            slots[2] = p;
            claim(p.userId);
        }
        // Slot 1 and 2 both taken for this category: leave this person for another
        // category's slot (or unranked) rather than backfilling a 3rd place.
    }

    for (const cat of CATEGORIES) {
        const slots = categorySlots.get(cat);
        if (slots[1]) winners.push({ userId: slots[1].userId, tier: TIERS.CATEGORY_1, category: cat, score: slots[1].score });
        if (slots[2]) winners.push({ userId: slots[2].userId, tier: TIERS.CATEGORY_2, category: cat, score: slots[2].score });
        // No 2nd-place candidate left in this category: slot is intentionally left
        // unawarded, never backfilled from another category.
    }

    return winners;
}

module.exports = { allocatePrizes };
