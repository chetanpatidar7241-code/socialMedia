const { allocatePrizes } = require('./allocatePrizes');
const { TIERS } = require('../constants');

function post(overrides) {
    return { userId: 'u', category: 'Art', likes: 0, comments: 0, views: 0, score: 0, createdAt: '2024-01-01T00:00:00Z', ...overrides };
}

describe('allocatePrizes', () => {
    test('Grand Prize goes to the single highest-scoring post', () => {
        const posts = [
            post({ userId: 'u1', score: 100, category: 'Art' }),
            post({ userId: 'u2', score: 200, category: 'Tech' }),
            post({ userId: 'u3', score: 150, category: 'Dance' })
        ];
        const winners = allocatePrizes(posts, []);
        expect(winners.find((w) => w.tier === TIERS.GRAND_PRIZE)).toMatchObject({ userId: 'u2', score: 200 });
    });

    test('tie score: comments desc breaks the tie', () => {
        const posts = [
            post({ userId: 'u1', score: 150, comments: 10, views: 50, category: 'Art' }),
            post({ userId: 'u2', score: 150, comments: 20, views: 10, category: 'Tech' })
        ];
        const winners = allocatePrizes(posts, []);
        expect(winners.find((w) => w.tier === TIERS.GRAND_PRIZE).userId).toBe('u2');
    });

    test('tie score with equal comments: views desc breaks the tie', () => {
        const posts = [
            post({ userId: 'u1', score: 150, comments: 10, views: 5, category: 'Art' }),
            post({ userId: 'u2', score: 150, comments: 10, views: 50, category: 'Tech' })
        ];
        const winners = allocatePrizes(posts, []);
        expect(winners.find((w) => w.tier === TIERS.GRAND_PRIZE).userId).toBe('u2');
    });

    test('tie score with equal comments and views: earliest timestamp wins', () => {
        const posts = [
            post({ userId: 'u1', score: 150, comments: 10, views: 5, createdAt: '2024-02-01T00:00:00Z', category: 'Art' }),
            post({ userId: 'u2', score: 150, comments: 10, views: 5, createdAt: '2024-01-01T00:00:00Z', category: 'Tech' })
        ];
        const winners = allocatePrizes(posts, []);
        expect(winners.find((w) => w.tier === TIERS.GRAND_PRIZE).userId).toBe('u2');
    });

    test('ineligible (non-Chhattisgarh) posts are excluded entirely', () => {
        const posts = [
            post({ userId: 'outsider', score: 9999, category: 'Art', residency: 'Delhi' }),
            post({ userId: 'local', score: 10, category: 'Art', residency: 'Chhattisgarh' })
        ];
        const winners = allocatePrizes(posts, []);
        expect(winners.some((w) => w.userId === 'outsider')).toBe(false);
        expect(winners.find((w) => w.tier === TIERS.GRAND_PRIZE).userId).toBe('local');
    });

    test('multi-category leader gets only their single strongest category; the other cascades', () => {
        const posts = [
            // u1 leads BOTH Art (higher) and Music (lower) among non-grand-prize/top-performer contenders.
            post({ userId: 'u1', score: 90, category: 'Art' }),
            post({ userId: 'u1', score: 80, category: 'Music' }),
            post({ userId: 'u2', score: 70, category: 'Music' }), // should get Music 1st once u1 is claimed by Art
            // 11 fillers fully saturate Grand Prize (1) + Top Performer (10) so u1/u2 are
            // only ever in contention for the category tier below.
            ...Array.from({ length: 11 }, (_, i) => post({ userId: `tp${i}`, score: 1000 - i, category: 'Sports' }))
        ];
        const winners = allocatePrizes(posts, []);
        const u1Wins = winners.filter((w) => w.userId === 'u1');
        expect(u1Wins).toHaveLength(1);
        expect(u1Wins[0]).toMatchObject({ tier: TIERS.CATEGORY_1, category: 'Art' });
        expect(winners.find((w) => w.category === 'Music' && w.tier === TIERS.CATEGORY_1)).toMatchObject({ userId: 'u2' });
    });

    test('exhausted category: only one eligible person ever posted -> 2nd place left unawarded, no backfill', () => {
        const posts = [
            post({ userId: 'solo', score: 50, category: 'Cooking' }),
            ...Array.from({ length: 11 }, (_, i) => post({ userId: `tp${i}`, score: 1000 - i, category: 'Sports' }))
        ];
        const winners = allocatePrizes(posts, []);
        expect(winners.find((w) => w.category === 'Cooking' && w.tier === TIERS.CATEGORY_1)).toMatchObject({ userId: 'solo' });
        expect(winners.some((w) => w.category === 'Cooking' && w.tier === TIERS.CATEGORY_2)).toBe(false);
        // Never backfilled from an unrelated category.
        expect(winners.filter((w) => w.tier === TIERS.CATEGORY_2 && w.category === 'Cooking')).toHaveLength(0);
    });

    test('consistency ranking: only fully-consistent creators win, ranked by total score', () => {
        const posts = [post({ userId: 'filler', score: 1, category: 'Art' })];
        const consistency = [
            { userId: 'u1', isConsistent: true, totalConsistencyScore: 500 },
            { userId: 'u2', isConsistent: true, totalConsistencyScore: 600 },
            { userId: 'missed_one_week', isConsistent: false, totalConsistencyScore: 1000 }
        ];
        const winners = allocatePrizes(posts, consistency);
        expect(winners.find((w) => w.tier === TIERS.CONSISTENCY_1).userId).toBe('u2');
        expect(winners.find((w) => w.tier === TIERS.CONSISTENCY_2).userId).toBe('u1');
        expect(winners.some((w) => w.userId === 'missed_one_week')).toBe(false);
    });

    test('one prize per person: Grand Prize winner is excluded from every later tier', () => {
        const posts = [
            post({ userId: 'u1', score: 1000, category: 'Art' }),
            post({ userId: 'u1', score: 999, category: 'Music' })
        ];
        const consistency = [{ userId: 'u1', isConsistent: true, totalConsistencyScore: 9999 }];
        const winners = allocatePrizes(posts, consistency);
        const u1Wins = winners.filter((w) => w.userId === 'u1');
        expect(u1Wins).toHaveLength(1);
        expect(u1Wins[0].tier).toBe(TIERS.GRAND_PRIZE);
    });

    test('disqualified (KYC-failed) users are excluded even on a from-scratch allocation', () => {
        const posts = [
            post({ userId: 'u1', score: 200, category: 'Art' }),
            post({ userId: 'u2', score: 150, category: 'Art' })
        ];
        const winners = allocatePrizes(posts, [], new Set(['u1']));
        expect(winners.find((w) => w.tier === TIERS.GRAND_PRIZE).userId).toBe('u2');
    });
});
