const { findReplacement } = require('./findReplacement');
const { TIERS } = require('../constants');

function post(overrides) {
    return { userId: 'u', category: 'Art', likes: 0, comments: 0, views: 0, score: 0, createdAt: '2024-01-01T00:00:00Z', ...overrides };
}

describe('findReplacement (KYC failure cascade)', () => {
    test('Grand Prize cascades to the next-highest-scoring eligible person', () => {
        const posts = [
            post({ userId: 'u1', score: 300 }), // KYC-failed, already excluded by caller
            post({ userId: 'u2', score: 200 }),
            post({ userId: 'u3', score: 100 })
        ];
        const replacement = findReplacement({
            tier: TIERS.GRAND_PRIZE,
            category: null,
            posts,
            consistency: [],
            excludeUserIds: new Set(['u1'])
        });
        expect(replacement).toEqual({ userId: 'u2', score: 200 });
    });

    test('chained cascade: failing the replacement promotes the next person down the line', () => {
        const posts = [
            post({ userId: 'u1', score: 300, category: 'Art' }),
            post({ userId: 'u2', score: 200, category: 'Art' }),
            post({ userId: 'u3', score: 100, category: 'Art' })
        ];

        // Step 1: u1 (current Category_1 holder) fails.
        const step1 = findReplacement({ tier: TIERS.CATEGORY_1, category: 'Art', posts, consistency: [], excludeUserIds: new Set(['u1']) });
        expect(step1.userId).toBe('u2');

        // Step 2: u2 (the just-promoted holder) also fails. u1 stays excluded (historical failure).
        const step2 = findReplacement({
            tier: TIERS.CATEGORY_1,
            category: 'Art',
            posts,
            consistency: [],
            excludeUserIds: new Set(['u1', 'u2'])
        });
        expect(step2.userId).toBe('u3');
    });

    test('category exhausted: no eligible replacement left -> null (slot stays unawarded, no backfill)', () => {
        const posts = [post({ userId: 'solo', score: 50, category: 'Cooking' })];
        const replacement = findReplacement({
            tier: TIERS.CATEGORY_2,
            category: 'Cooking',
            posts,
            consistency: [],
            excludeUserIds: new Set(['solo']) // the only person who ever posted in this category
        });
        expect(replacement).toBeNull();
    });

    test('replacement never chosen from a person who already holds a different active prize', () => {
        const posts = [
            post({ userId: 'grand_prize_holder', score: 500, category: 'Art' }),
            post({ userId: 'next', score: 100, category: 'Art' })
        ];
        // grand_prize_holder isn't disqualified, just already holds another slot.
        const replacement = findReplacement({
            tier: TIERS.CATEGORY_1,
            category: 'Art',
            posts,
            consistency: [],
            excludeUserIds: new Set(['grand_prize_holder', 'failed_category1_holder'])
        });
        expect(replacement.userId).toBe('next');
    });

    test('Consistency slot cascades using totalConsistencyScore, ignoring non-consistent creators', () => {
        const consistency = [
            { userId: 'u1', isConsistent: true, totalConsistencyScore: 900 },
            { userId: 'u2', isConsistent: false, totalConsistencyScore: 950 }, // missed a week, ineligible
            { userId: 'u3', isConsistent: true, totalConsistencyScore: 800 }
        ];
        const replacement = findReplacement({
            tier: TIERS.CONSISTENCY_2,
            category: null,
            posts: [],
            consistency,
            excludeUserIds: new Set(['u1'])
        });
        expect(replacement).toEqual({ userId: 'u3', score: 800 });
    });
});
