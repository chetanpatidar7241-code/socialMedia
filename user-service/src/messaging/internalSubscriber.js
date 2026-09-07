const { getConnection, codec } = require('./natsClient');
const config = require('../config/env');
const internalService = require('../services/internalService');
const { ResponseMessage } = require('../utils/ResponseMessage');
const { StatusCodes } = require('http-status-codes');

// GET /api/internal/rankings and GET /api/internal/users are gone — this is the
// replacement transport. Subjects are the NATS equivalent of those two route paths.
const SUBJECTS = {
    RANKINGS: 'internal.rankings.get',
    USERS: 'internal.users.get'
};

// NATS request/reply has no built-in per-subject ACL, so the shared secret that used
// to guard these routes as the `x-internal-api-key` header is now stamped into the
// request payload instead, and checked the same way: exact match against this
// service's own INTERNAL_API_KEY.
function isAuthorized(payload) {
    return typeof payload?.apiKey === 'string' && payload.apiKey === config.internalApiKey;
}

function decodePayload(msg) {
    try {
        return msg.data.length ? codec.decode(msg.data) : {};
    } catch {
        return {};
    }
}

async function handleRankingsRequest(msg) {
    const payload = decodePayload(msg);

    if (!isAuthorized(payload)) {
        return msg.respond(codec.encode({ ok: false, statusCode: StatusCodes.UNAUTHORIZED, message: ResponseMessage.UNAUTHORIZED }));
    }

    try {
        const data = await internalService.getRankingsData();
        msg.respond(codec.encode({ ok: true, message: ResponseMessage.RANKINGS_FETCHED, data }));
    } catch (error) {
        console.error(`[nats] ${SUBJECTS.RANKINGS} handler failed:`, error);
        msg.respond(codec.encode({ ok: false, statusCode: StatusCodes.INTERNAL_SERVER_ERROR, message: ResponseMessage.INTERNAL_SERVER_ERROR }));
    }
}

async function handleUsersRequest(msg) {
    const payload = decodePayload(msg);

    if (!isAuthorized(payload)) {
        return msg.respond(codec.encode({ ok: false, statusCode: StatusCodes.UNAUTHORIZED, message: ResponseMessage.UNAUTHORIZED }));
    }

    try {
        const data = await internalService.getUsersByIds(payload.ids);
        msg.respond(codec.encode({ ok: true, message: ResponseMessage.USERS_FETCHED, data }));
    } catch (error) {
        if (error.statusCode) {
            return msg.respond(codec.encode({ ok: false, statusCode: error.statusCode, message: error.message }));
        }
        console.error(`[nats] ${SUBJECTS.USERS} handler failed:`, error);
        msg.respond(codec.encode({ ok: false, statusCode: StatusCodes.INTERNAL_SERVER_ERROR, message: ResponseMessage.INTERNAL_SERVER_ERROR }));
    }
}

async function startInternalSubscriptions() {
    const nc = await getConnection();

    const rankingsSub = nc.subscribe(SUBJECTS.RANKINGS);
    (async () => {
        for await (const msg of rankingsSub) {
            handleRankingsRequest(msg);
        }
    })();

    const usersSub = nc.subscribe(SUBJECTS.USERS);
    (async () => {
        for await (const msg of usersSub) {
            handleUsersRequest(msg);
        }
    })();

    console.log(`[nats] subscribed to ${SUBJECTS.RANKINGS} and ${SUBJECTS.USERS}`);
}

module.exports = { startInternalSubscriptions, handleRankingsRequest, handleUsersRequest, isAuthorized, SUBJECTS };
