const { getConnection, codec, NATS_TIMEOUT_MS } = require('../messaging/natsClient');
const config = require('../config/env');

// Same subjects the User Service subscribes to (src/messaging/internalSubscriber.js
// over there) — the NATS equivalent of the old GET /api/internal/rankings and
// GET /api/internal/users routes.
const SUBJECTS = {
    RANKINGS: 'internal.rankings.get',
    USERS: 'internal.users.get'
};

// Every field the ranking engine needs (post scores, categories, consistency) still
// crosses the service boundary through one call — the Admin Service never touches
// the User Service's MongoDB, satisfying the "no shared DB access" architecture rule.
// Only the transport changed (HTTP -> NATS request/reply); this stays a synchronous,
// latency-sensitive round trip, not a fire-and-forget event.
async function request(subject, payload) {
    const nc = await getConnection();

    let msg;
    try {
        msg = await nc.request(subject, codec.encode(payload), { timeout: NATS_TIMEOUT_MS });
    } catch (err) {
        // nats.js throws on no reply within NATS_TIMEOUT_MS (subject code 'TIMEOUT')
        // or when the broker/subscriber is unreachable — both surface as a plain
        // Error with no .statusCode, same as an unreachable/timed-out axios call used
        // to: it falls through to sendError's generic 500 branch, matching prior behavior.
        throw new Error(`User Service did not respond on "${subject}": ${err.message}`);
    }

    const reply = codec.decode(msg.data);
    if (!reply.ok) {
        const error = new Error(reply.message || 'User Service request failed');
        error.statusCode = reply.statusCode;
        throw error;
    }
    return reply.data;
}

async function fetchRankingData() {
    const data = await request(SUBJECTS.RANKINGS, { apiKey: config.internalApiKey });
    if (!Array.isArray(data.posts) || !Array.isArray(data.consistency)) {
        const err = new Error('User Service returned an unexpected ranking data shape');
        err.statusCode = 502;
        throw err;
    }
    return data;
}

// Resolves raw userIds (the only form a Winner row stores) into { [id]: { username } }
// for display purposes — Admin Service never stores or looks up usernames itself.
async function fetchUsernames(userIds) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return {};

    return request(SUBJECTS.USERS, { apiKey: config.internalApiKey, ids: uniqueIds });
}

module.exports = { fetchRankingData, fetchUsernames };
