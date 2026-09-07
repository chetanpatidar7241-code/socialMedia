const { connect, JSONCodec } = require('nats');
const config = require('../config/env');

const codec = JSONCodec();
let connectionPromise = null;

// Matches the old axios client's `timeout: 10_000` — this is the only place that
// timeout value lived before, now shared by both the connect attempt and requests.
const NATS_TIMEOUT_MS = 10_000;

// Lazily connects on first use (mirrors the old axios client: nothing happens at
// admin-service boot, only when a ranking/KYC action actually needs the User
// Service). Deliberately does NOT wait-and-retry on a down broker the way
// user-service's subscriber-side client does — these are synchronous,
// latency-sensitive admin actions (an admin is sitting there waiting), so an
// unreachable NATS server must fail within NATS_TIMEOUT_MS, never hang indefinitely.
function getConnection() {
    if (!connectionPromise) {
        connectionPromise = connect({
            servers: config.natsUrl,
            name: 'admin-service',
            timeout: NATS_TIMEOUT_MS,
            reconnect: true,
            maxReconnectAttempts: -1,
            reconnectTimeWait: 2000
        }).catch((err) => {
            connectionPromise = null; // don't cache a failed connect — let the next call retry
            throw err;
        });
    }
    return connectionPromise;
}

module.exports = { getConnection, codec, NATS_TIMEOUT_MS };
