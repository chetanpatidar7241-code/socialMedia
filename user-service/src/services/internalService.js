const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const userRepository = require('../repositories/userRepository');
const postRepository = require('../repositories/postRepository');
const { ELIGIBLE_RESIDENCY } = require('../constants');
const { AppError } = require('../utils/AppError');
const { ResponseMessage } = require('../utils/ResponseMessage');

// Same aggregation the old GET /api/internal/rankings HTTP handler ran — moved here
// unchanged so it can be reused by the NATS subscriber without duplicating logic.
async function getRankingsData() {
    const eligibleUsers = await userRepository.findByResidency(ELIGIBLE_RESIDENCY);
    const eligibleUserIds = eligibleUsers.map((u) => u._id);
    const residencyByUser = new Map(eligibleUsers.map((u) => [u._id.toString(), u.residency]));

    const posts = await postRepository.findByUserIds(eligibleUserIds);

    const formattedPosts = posts.map((p) => {
        const score = p.likesCount * 1 + p.commentsCount * 3 + p.viewsCount * 0.2;
        return {
            postId: p._id.toString(),
            userId: p.userId.toString(),
            residency: residencyByUser.get(p.userId.toString()),
            category: p.category,
            likes: p.likesCount,
            comments: p.commentsCount,
            views: p.viewsCount,
            score,
            createdAt: p.createdAt,
            week: p.week
        };
    });

    const consistencyMap = {};

    formattedPosts.forEach((post) => {
        if (!consistencyMap[post.userId]) {
            consistencyMap[post.userId] = { weeks: { 1: [], 2: [], 3: [], 4: [] } };
        }
        if (post.week >= 1 && post.week <= 4) {
            consistencyMap[post.userId].weeks[post.week].push(post.score);
        }
    });

    const consistencyResult = [];
    for (const userId in consistencyMap) {
        const userWeeks = consistencyMap[userId].weeks;
        let isConsistent = true;
        let totalConsistencyScore = 0;
        const weekStats = {};

        for (let w = 1; w <= 4; w++) {
            const scores = userWeeks[w].sort((a, b) => b - a);
            const postsCount = scores.length;
            if (postsCount < 3) {
                isConsistent = false;
            }
            const top3 = scores.slice(0, 3);
            const sum = top3.reduce((a, b) => a + b, 0);
            weekStats[w] = { postsCount, top3ScoreSum: sum };
            totalConsistencyScore += sum;
        }

        consistencyResult.push({
            userId,
            weeks: weekStats,
            isConsistent,
            totalConsistencyScore: isConsistent ? totalConsistencyScore : 0
        });
    }

    return { posts: formattedPosts, consistency: consistencyResult };
}

// Resolves raw userIds into { [id]: { username } }. Takes an array now (the old HTTP
// handler took a comma-separated query string only because that's what URLs allow —
// the NATS transport carries a real JSON array, so the query-string round trip is
// no longer needed; the validation/dedupe/ObjectId-filtering logic is unchanged).
async function getUsersByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError(StatusCodes.BAD_REQUEST, ResponseMessage.USER_IDS_REQUIRED);
    }

    const uniqueValidIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))]
        .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const users = await userRepository.findByIds(uniqueValidIds);
    const usersById = {};
    users.forEach((u) => {
        usersById[u._id.toString()] = { username: u.username };
    });
    return usersById;
}

module.exports = { getRankingsData, getUsersByIds };
