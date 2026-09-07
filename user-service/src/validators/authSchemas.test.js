const { signupSchema, loginSchema, updateResidencySchema } = require('./authSchemas');
const { ResponseMessage } = require('../utils/ResponseMessage');

describe('signupSchema', () => {
    test('accepts a valid payload and trims username', () => {
        const { error, value } = signupSchema.validate({ username: '  bob  ', password: 'secret1', residency: 'Chhattisgarh' });
        expect(error).toBeUndefined();
        expect(value.username).toBe('bob');
    });

    test('rejects a missing field with the combined required message', () => {
        const { error } = signupSchema.validate({ username: 'bob', password: 'secret1' });
        expect(error.details[0].message).toBe(ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED);
    });

    test('rejects a too-short username', () => {
        const { error } = signupSchema.validate({ username: 'ab', password: 'secret1', residency: 'Chhattisgarh' });
        expect(error.details[0].message).toBe(ResponseMessage.USERNAME_LENGTH_INVALID);
    });

    test('rejects a too-short password', () => {
        const { error } = signupSchema.validate({ username: 'bob', password: '123', residency: 'Chhattisgarh' });
        expect(error.details[0].message).toBe(ResponseMessage.PASSWORD_LENGTH_INVALID);
    });

    test('rejects a residency not on the fixed list', () => {
        const { error } = signupSchema.validate({ username: 'bob', password: 'secret1', residency: 'Narnia' });
        expect(error.details[0].message).toBe(ResponseMessage.INVALID_RESIDENCY);
    });

    test('rejects a username with disallowed characters', () => {
        const { error } = signupSchema.validate({ username: 'bob!', password: 'secret1', residency: 'Chhattisgarh' });
        expect(error.details[0].message).toMatch(/letters, numbers, underscores and dots/);
    });
});

describe('loginSchema', () => {
    test('accepts a valid payload', () => {
        const { error } = loginSchema.validate({ username: 'bob', password: 'secret1' });
        expect(error).toBeUndefined();
    });

    test('rejects a missing password', () => {
        const { error } = loginSchema.validate({ username: 'bob' });
        expect(error.details[0].message).toBe(ResponseMessage.USERNAME_PASSWORD_REQUIRED);
    });
});

describe('updateResidencySchema', () => {
    test('accepts an eligible residency', () => {
        const { error } = updateResidencySchema.validate({ residency: 'Chhattisgarh' });
        expect(error).toBeUndefined();
    });

    test('rejects an unknown residency', () => {
        const { error } = updateResidencySchema.validate({ residency: 'Atlantis' });
        expect(error.details[0].message).toBe(ResponseMessage.INVALID_RESIDENCY);
    });

    test('rejects a missing residency', () => {
        const { error } = updateResidencySchema.validate({});
        expect(error.details[0].message).toBe(ResponseMessage.INVALID_RESIDENCY);
    });
});
