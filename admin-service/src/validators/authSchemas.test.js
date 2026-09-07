const { loginSchema } = require('./authSchemas');

describe('loginSchema (admin)', () => {
    test('accepts a valid payload', () => {
        const { error } = loginSchema.validate({ username: 'admin', password: 'Admin@123' });
        expect(error).toBeUndefined();
    });

    test('rejects a missing username', () => {
        const { error } = loginSchema.validate({ password: 'Admin@123' });
        expect(error.details[0].message).toBe('username and password are required');
    });

    test('rejects a missing password', () => {
        const { error } = loginSchema.validate({ username: 'admin' });
        expect(error.details[0].message).toBe('username and password are required');
    });

    test('rejects an empty string field', () => {
        const { error } = loginSchema.validate({ username: '', password: 'Admin@123' });
        expect(error.details[0].message).toBe('username and password are required');
    });
});
