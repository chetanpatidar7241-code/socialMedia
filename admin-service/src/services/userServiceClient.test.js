const { JSONCodec } = require('nats');
const codec = JSONCodec();

jest.mock('../config/env', () => ({ internalApiKey: 'secret123' }));
jest.mock('../messaging/natsClient', () => ({
    getConnection: jest.fn(),
    codec: require('nats').JSONCodec(),
    NATS_TIMEOUT_MS: 10000
}));

const { getConnection } = require('../messaging/natsClient');
const { fetchRankingData, fetchUsernames } = require('./userServiceClient');

function fakeReply(payload) {
    return { data: codec.encode(payload) };
}

afterEach(() => jest.clearAllMocks());

describe('fetchRankingData', () => {
    test('returns data on a successful reply, sending the shared secret as apiKey', async () => {
        const request = jest.fn().mockResolvedValue(fakeReply({ ok: true, data: { posts: [], consistency: [] } }));
        getConnection.mockResolvedValue({ request });

        const data = await fetchRankingData();

        expect(data).toEqual({ posts: [], consistency: [] });
        expect(request).toHaveBeenCalledWith(
            'internal.rankings.get',
            expect.any(Uint8Array),
            expect.objectContaining({ timeout: 10000 })
        );
        expect(codec.decode(request.mock.calls[0][1])).toEqual({ apiKey: 'secret123' });
    });

    test('throws a 502 error when the reply payload has an unexpected shape', async () => {
        const request = jest.fn().mockResolvedValue(fakeReply({ ok: true, data: { posts: 'nope', consistency: [] } }));
        getConnection.mockResolvedValue({ request });

        await expect(fetchRankingData()).rejects.toMatchObject({ statusCode: 502 });
    });

    test('propagates the statusCode/message from an ok:false reply (e.g. auth failure)', async () => {
        const request = jest.fn().mockResolvedValue(fakeReply({ ok: false, statusCode: 401, message: 'Unauthorized' }));
        getConnection.mockResolvedValue({ request });

        await expect(fetchRankingData()).rejects.toMatchObject({ statusCode: 401, message: 'Unauthorized' });
    });

    test('throws a plain error with no statusCode when NATS times out or is unreachable', async () => {
        const request = jest.fn().mockRejectedValue(new Error('TIMEOUT'));
        getConnection.mockResolvedValue({ request });

        let caught;
        try {
            await fetchRankingData();
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(Error);
        expect(caught.message).toMatch(/did not respond/);
        expect(caught.statusCode).toBeUndefined();
    });
});

describe('fetchUsernames', () => {
    test('returns {} without contacting NATS for an empty id list', async () => {
        const result = await fetchUsernames([]);

        expect(result).toEqual({});
        expect(getConnection).not.toHaveBeenCalled();
    });

    test('dedupes ids and returns the resolved usernames', async () => {
        const request = jest.fn().mockResolvedValue(fakeReply({ ok: true, data: { u1: { username: 'alice' } } }));
        getConnection.mockResolvedValue({ request });

        const result = await fetchUsernames(['u1', 'u1', 'u2']);

        expect(result).toEqual({ u1: { username: 'alice' } });
        const sentPayload = codec.decode(request.mock.calls[0][1]);
        expect(sentPayload).toEqual({ apiKey: 'secret123', ids: ['u1', 'u2'] });
    });
});
