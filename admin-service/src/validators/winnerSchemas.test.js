const { winnerIdParamsSchema, updateKycBodySchema, listWinnersQuerySchema } = require('./winnerSchemas');
const { TIERS } = require('../constants');

describe('winnerIdParamsSchema', () => {
    test('accepts and converts a numeric id string', () => {
        const { error, value } = winnerIdParamsSchema.validate({ id: '5' });
        expect(error).toBeUndefined();
        expect(value.id).toBe(5);
    });

    test('rejects a non-numeric id (stricter than the old parseInt-based check)', () => {
        const { error } = winnerIdParamsSchema.validate({ id: '5abc' });
        expect(error.details[0].message).toBe('Invalid winner id');
    });

    test('rejects a missing id', () => {
        const { error } = winnerIdParamsSchema.validate({});
        expect(error.details[0].message).toBe('Invalid winner id');
    });
});

describe('updateKycBodySchema', () => {
    test('accepts PASSED', () => {
        const { error } = updateKycBodySchema.validate({ status: 'PASSED' });
        expect(error).toBeUndefined();
    });

    test('accepts FAILED', () => {
        const { error } = updateKycBodySchema.validate({ status: 'FAILED' });
        expect(error).toBeUndefined();
    });

    test('rejects an unknown status', () => {
        const { error } = updateKycBodySchema.validate({ status: 'MAYBE' });
        expect(error.details[0].message).toBe("status must be 'PASSED' or 'FAILED'");
    });

    test('rejects a missing status', () => {
        const { error } = updateKycBodySchema.validate({});
        expect(error.details[0].message).toBe("status must be 'PASSED' or 'FAILED'");
    });
});

describe('listWinnersQuerySchema', () => {
    test('accepts no filters', () => {
        const { error } = listWinnersQuerySchema.validate({});
        expect(error).toBeUndefined();
    });

    test('accepts a valid tier', () => {
        const { error } = listWinnersQuerySchema.validate({ tier: TIERS.GRAND_PRIZE });
        expect(error).toBeUndefined();
    });

    test('rejects an invalid tier', () => {
        const { error } = listWinnersQuerySchema.validate({ tier: 'NOT_A_TIER' });
        expect(error.details[0].message).toMatch(/tier must be one of/);
    });

    test('accepts an arbitrary category string (category validity is not tier-scoped here)', () => {
        const { error } = listWinnersQuerySchema.validate({ category: 'Art' });
        expect(error).toBeUndefined();
    });
});
