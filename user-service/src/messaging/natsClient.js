const { connect, JSONCodec } = require('nats');
const config = require('../config/env');

const codec = JSONCodec();
let connectionPromise = null;

// Lazily connects once and reuses the same connection for the process lifetime.
// `waitOnFirstConnect: true` means a NATS server that isn't up yet at boot doesn't
// crash this service or block startup — the connect attempt keeps retrying with
// backoff in the background, since the public auth/post HTTP routes don't depend on
// NATS at all and must keep serving regardless of broker availability. Subscriptions
// made on this connection are automatically re-established by the client after a
// reconnect, so no extra "resubscribe" code is needed here.
function getConnection() {
    if (!connectionPromise) {
        connectionPromise = connect({
            servers: config.natsUrl,
            name: 'user-service',
            waitOnFirstConnect: true,
            reconnect: true,
            maxReconnectAttempts: -1,
            reconnectTimeWait: 2000
        });

        connectionPromise
            .then((nc) => {
                console.log(`[nats] user-service connected to ${config.natsUrl}`);
                (async () => {
                    for await (const status of nc.status()) {
                        console.log(`[nats] ${status.type}`);
                    }
                })();
            })
            .catch((err) => {
                console.error('[nats] user-service connection failed:', err.message);
                connectionPromise = null; // allow a later retry instead of caching a dead promise forever
            });
    }
    return connectionPromise;
}

module.exports = { getConnection, codec };
