const axios = require('axios');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:4000/api/internal';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Every field the ranking engine needs (post scores, categories, consistency) crosses
// the service boundary through this one HTTP call — the Admin Service never touches
// the User Service's MongoDB, satisfying the "no shared DB access" architecture rule.
async function fetchRankingData() {
    const { data: envelope } = await axios.get(`${USER_SERVICE_URL}/rankings`, {
        headers: { 'x-internal-api-key': INTERNAL_API_KEY },
        timeout: 10_000
    });
    // User Service responses are wrapped as { message, data } — unwrap once here so
    // the rest of the Admin Service only ever deals with the actual payload shape.
    const data = envelope?.data ?? envelope;
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

    const { data: envelope } = await axios.get(`${USER_SERVICE_URL}/users`, {
        headers: { 'x-internal-api-key': INTERNAL_API_KEY },
        params: { ids: uniqueIds.join(',') },
        timeout: 10_000
    });
    return envelope?.data ?? envelope;
}

module.exports = { fetchRankingData, fetchUsernames };
