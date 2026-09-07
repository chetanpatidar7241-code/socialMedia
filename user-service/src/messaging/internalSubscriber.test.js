const { JSONCodec } = require('nats');
const codec = JSONCodec();

jest.mock('../config/env', () => ({ internalApiKey: 'secret123' }));
jest.mock('../services/internalService');

const internalService = require('../services/internalService');
const { handleRankingsRequest, handleUsersRequest, isAuthorized } = require('./internalSubscriber');

function makeMsg(payload) {
    return {
        data: codec.encode(payload),
        respond: jest.fn()
    };
}

function decodeRespond(msg) {
    expect(msg.respond).toHaveBeenCalledTimes(1);
    return codec.decode(msg.respond.mock.calls[0][0]);
}

afterEach(() => jest.clearAllMocks());

describe('isAuthorized', () => {
    test('true when apiKey matches this service\'s INTERNAL_API_KEY', () => {
        expect(isAuthorized({ apiKey: 'secret123' })).toBe(true);
    });

    test('false when apiKey is missing or wrong', () => {
        expect(isAuthorized({})).toBe(false);
        expect(isAuthorized({ apiKey: 'wrong' })).toBe(false);
    });
});

describe('handleRankingsRequest', () => {
    test('replies 401 and never calls the service when apiKey is wrong', async () => {
        const msg = makeMsg({ apiKey: 'wrong' });

        await handleRankingsRequest(msg);

        const reply = decodeRespond(msg);
        expect(reply).toMatchObject({ ok: false, statusCode: 401 });
        expect(internalService.getRankingsData).not.toHaveBeenCalled();
    });

    test('replies with the service data on success', async () => {
        internalService.getRankingsData.mockResolvedValue({ posts: [], consistency: [] });
        const msg = makeMsg({ apiKey: 'secret123' });

        await handleRankingsRequest(msg);

        const reply = decodeRespond(msg);
        expect(reply).toEqual({ ok: true, message: expect.any(String), data: { posts: [], consistency: [] } });
    });

    test('replies 500 when the service throws unexpectedly', async () => {
        internalService.getRankingsData.mockRejectedValue(new Error('db down'));
        const msg = makeMsg({ apiKey: 'secret123' });

        await handleRankingsRequest(msg);

        const reply = decodeRespond(msg);
        expect(reply).toMatchObject({ ok: false, statusCode: 500 });
    });
});

describe('handleUsersRequest', () => {
    test('replies 401 and never calls the service when apiKey is wrong', async () => {
        const msg = makeMsg({ apiKey: 'nope', ids: ['a'] });

        await handleUsersRequest(msg);

        const reply = decodeRespond(msg);
        expect(reply).toMatchObject({ ok: false, statusCode: 401 });
        expect(internalService.getUsersByIds).not.toHaveBeenCalled();
    });

    test('propagates a business-level AppError statusCode/message (e.g. missing ids)', async () => {
        const err = new Error('ids field is required (a non-empty array of user ids)');
        err.statusCode = 400;
        internalService.getUsersByIds.mockRejectedValue(err);
        const msg = makeMsg({ apiKey: 'secret123', ids: [] });

        await handleUsersRequest(msg);

        const reply = decodeRespond(msg);
        expect(reply).toEqual({ ok: false, statusCode: 400, message: err.message });
    });

    test('replies with the service data on success', async () => {
        internalService.getUsersByIds.mockResolvedValue({ u1: { username: 'alice' } });
        const msg = makeMsg({ apiKey: 'secret123', ids: ['u1'] });

        await handleUsersRequest(msg);

        const reply = decodeRespond(msg);
        expect(reply).toEqual({ ok: true, message: expect.any(String), data: { u1: { username: 'alice' } } });
    });
});
