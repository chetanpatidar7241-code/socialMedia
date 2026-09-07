const jwt = require('jsonwebtoken');
const { createAuthMiddleware, createOptionalAuthMiddleware } = require('./verifyToken');

const SECRET = 'test-secret';
const OTHER_SECRET = 'other-secret';

function makeReq(token) {
    return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}

describe('createAuthMiddleware', () => {
    test('throws if secret is missing', () => {
        expect(() => createAuthMiddleware({ onMissingToken: () => {}, onInvalidToken: () => {} })).toThrow();
    });

    test('throws if the failure callbacks are missing', () => {
        expect(() => createAuthMiddleware({ secret: SECRET })).toThrow();
    });

    test('calls onMissingToken when no Authorization header is present', () => {
        const onMissingToken = jest.fn();
        const onInvalidToken = jest.fn();
        const next = jest.fn();
        const middleware = createAuthMiddleware({ secret: SECRET, onMissingToken, onInvalidToken });

        middleware(makeReq(null), {}, next);

        expect(onMissingToken).toHaveBeenCalledTimes(1);
        expect(onInvalidToken).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('calls onInvalidToken for a malformed token', () => {
        const onMissingToken = jest.fn();
        const onInvalidToken = jest.fn();
        const next = jest.fn();
        const middleware = createAuthMiddleware({ secret: SECRET, onMissingToken, onInvalidToken });

        middleware(makeReq('not-a-real-jwt'), {}, next);

        expect(onInvalidToken).toHaveBeenCalledTimes(1);
        expect(next).not.toHaveBeenCalled();
    });

    // The whole point of keeping JWT_SECRET and ADMIN_JWT_SECRET separate: a token
    // signed for one service must never verify against the other's secret.
    test('rejects a token signed with a different secret (service isolation)', () => {
        const token = jwt.sign({ userId: 'u1' }, OTHER_SECRET);
        const onMissingToken = jest.fn();
        const onInvalidToken = jest.fn();
        const next = jest.fn();
        const middleware = createAuthMiddleware({ secret: SECRET, onMissingToken, onInvalidToken });

        middleware(makeReq(token), {}, next);

        expect(onInvalidToken).toHaveBeenCalledTimes(1);
        expect(next).not.toHaveBeenCalled();
    });

    test('attaches the decoded payload and calls next() for a valid token', () => {
        const token = jwt.sign({ userId: 'u1', residency: 'Chhattisgarh' }, SECRET);
        const req = makeReq(token);
        const next = jest.fn();
        const middleware = createAuthMiddleware({
            secret: SECRET,
            attachAs: 'user',
            onMissingToken: jest.fn(),
            onInvalidToken: jest.fn()
        });

        middleware(req, {}, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user.userId).toBe('u1');
        expect(req.user.residency).toBe('Chhattisgarh');
    });

    test('attaches to a custom attachAs key (e.g. admin routes use req.admin)', () => {
        const token = jwt.sign({ role: 'admin', adminId: 1 }, SECRET);
        const req = makeReq(token);
        const next = jest.fn();
        const middleware = createAuthMiddleware({
            secret: SECRET,
            attachAs: 'admin',
            onMissingToken: jest.fn(),
            onInvalidToken: jest.fn()
        });

        middleware(req, {}, next);

        expect(req.admin.role).toBe('admin');
        expect(req.user).toBeUndefined();
    });
});

describe('createOptionalAuthMiddleware', () => {
    test('proceeds anonymously with no token', () => {
        const req = makeReq(null);
        const next = jest.fn();
        const middleware = createOptionalAuthMiddleware({ secret: SECRET });

        middleware(req, {}, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user).toBeUndefined();
    });

    test('proceeds anonymously with an invalid token instead of rejecting', () => {
        const req = makeReq('garbage');
        const next = jest.fn();
        const middleware = createOptionalAuthMiddleware({ secret: SECRET });

        middleware(req, {}, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user).toBeUndefined();
    });

    test('attaches the decoded payload for a valid token', () => {
        const token = jwt.sign({ userId: 'u1' }, SECRET);
        const req = makeReq(token);
        const next = jest.fn();
        const middleware = createOptionalAuthMiddleware({ secret: SECRET });

        middleware(req, {}, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user.userId).toBe('u1');
    });
});
