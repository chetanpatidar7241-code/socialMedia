const { generateRankingsSchema } = require('./rankingSchemas');

describe('generateRankingsSchema', () => {
    test('defaults force to false when omitted', () => {
        const { error, value } = generateRankingsSchema.validate({});
        expect(error).toBeUndefined();
        expect(value.force).toBe(false);
    });

    test('accepts force: true', () => {
        const { error, value } = generateRankingsSchema.validate({ force: true });
        expect(error).toBeUndefined();
        expect(value.force).toBe(true);
    });

    test('rejects a non-boolean force value', () => {
        const { error } = generateRankingsSchema.validate({ force: 'yes' });
        expect(error).toBeDefined();
    });
});
