const { compareByScore } = require('./tieBreak');
const { ELIGIBLE_RESIDENCY } = require('../constants');

// Defense in depth: the User Service already filters to Chhattisgarh residents before
// handing data over (it owns residency data per the architecture rules), but we don't
// blindly trust an upstream payload shape for a contest-eligibility decision — if a
// `residency` field is present it must match, closing the "ineligible user" edge case
// on this side too.
function eligiblePosts(posts) {
    return posts.filter((p) => p.residency === undefined || p.residency === ELIGIBLE_RESIDENCY);
}

// Best single post per creator across all categories, sorted by score/tie-break desc.
// Backs both the Grand Prize slot and the Top Performer pool (both draw from "a
// creator's single best post, globally").
function computeGlobalRanking(posts) {
    const bestByUser = new Map();
    for (const p of eligiblePosts(posts)) {
        const current = bestByUser.get(p.userId);
        if (!current || compareByScore(p, current) < 0) bestByUser.set(p.userId, p);
    }
    return Array.from(bestByUser.values()).sort(compareByScore);
}

// Consistency ranking: only creators with 3+ posts in every one of the 4 weeks;
// score = top-3 posts/week summed across all 4 weeks (computed upstream, trusted here).
function computeConsistencyRanking(consistency) {
    return consistency
        .filter((c) => c.isConsistent)
        .slice()
        .sort((a, b) => b.totalConsistencyScore - a.totalConsistencyScore || String(a.userId).localeCompare(String(b.userId)));
}

// Best post per creator, per category -> { [category]: [posts sorted desc] }.
// Used both to build the initial cross-category allocation order and to look up a
// single category's remaining candidates when cascading a vacated slot.
function computeCategoryRankings(posts) {
    const bestByUserByCategory = new Map(); // category -> Map(userId -> bestPost)
    for (const p of eligiblePosts(posts)) {
        if (!bestByUserByCategory.has(p.category)) bestByUserByCategory.set(p.category, new Map());
        const byUser = bestByUserByCategory.get(p.category);
        const current = byUser.get(p.userId);
        if (!current || compareByScore(p, current) < 0) byUser.set(p.userId, p);
    }

    const result = {};
    for (const [category, byUser] of bestByUserByCategory) {
        result[category] = Array.from(byUser.values()).sort(compareByScore);
    }
    return result;
}

module.exports = { computeGlobalRanking, computeConsistencyRanking, computeCategoryRankings, eligiblePosts };
