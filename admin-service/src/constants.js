const CATEGORIES = ['Art', 'Music', 'Dance', 'Sports', 'Cooking', 'Tech', 'Comedy', 'Education', 'Fashion', 'Gaming'];
const ELIGIBLE_RESIDENCY = 'Chhattisgarh';

const TIERS = {
    GRAND_PRIZE: 'GRAND_PRIZE',
    CONSISTENCY_1: 'CONSISTENCY_1',
    CONSISTENCY_2: 'CONSISTENCY_2',
    TOP_PERFORMER: 'TOP_PERFORMER',
    CATEGORY_1: 'CATEGORY_1',
    CATEGORY_2: 'CATEGORY_2'
};

// Priority order for allocation AND for a new prize tier to be added later without
// touching the cascade/allocation engine itself — see README "Extending" section.
const TIER_PRIORITY = [
    { tier: TIERS.GRAND_PRIZE, slots: 1 },
    { tier: TIERS.CONSISTENCY_1, slots: 1 },
    { tier: TIERS.CONSISTENCY_2, slots: 1 },
    { tier: TIERS.TOP_PERFORMER, slots: 10 },
    { tier: TIERS.CATEGORY_1, slots: CATEGORIES.length },
    { tier: TIERS.CATEGORY_2, slots: CATEGORIES.length }
];

const TOTAL_PRIZES = TIER_PRIORITY.reduce((sum, t) => sum + t.slots, 0); // 33

module.exports = { CATEGORIES, ELIGIBLE_RESIDENCY, TIERS, TIER_PRIORITY, TOTAL_PRIZES };
