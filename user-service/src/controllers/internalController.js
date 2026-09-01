const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Post = require("../models/Post");
const User = require("../models/User");
const { ELIGIBLE_RESIDENCY } = require("../constants");
const { sendError } = require("../utils/AppError");
const { sendResponse } = require("../services/CommonService");
const { ResponseMessage } = require("../utils/ResponseMessage");

// #region Rankings
exports.getRankingsData = async (req, res) => {
  try {
    const eligibleUsers = await User.find({
      residency: ELIGIBLE_RESIDENCY,
    }).select("_id residency");
    const eligibleUserIds = eligibleUsers.map((u) => u._id);
    const residencyByUser = new Map(
      eligibleUsers.map((u) => [u._id.toString(), u.residency])
    );

    const posts = await Post.find({ userId: { $in: eligibleUserIds } }).lean();

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
        week: p.week,
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
        totalConsistencyScore: isConsistent ? totalConsistencyScore : 0,
      });
    }

    sendResponse(res, StatusCodes.OK, ResponseMessage.RANKINGS_FETCHED, {
      posts: formattedPosts,
      consistency: consistencyResult,
    });
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion

// #region Users lookup
// Lets the Admin Service resolve the raw userId it stores on a Winner row into a
// human-readable username for display, without ever touching the User Service's
// MongoDB directly (Admin Service only ever stores the id, never the username).
exports.getUsersByIds = async (req, res) => {
  try {
    const idsParam = req.query.ids;
    if (typeof idsParam !== "string" || idsParam.trim().length === 0) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, ResponseMessage.USER_IDS_REQUIRED);
    }

    const ids = [...new Set(idsParam.split(",").map((id) => id.trim()).filter(Boolean))]
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const users = await User.find({ _id: { $in: ids } }).select("_id username");
    const usersById = {};
    users.forEach((u) => {
      usersById[u._id.toString()] = { username: u.username };
    });

    sendResponse(res, StatusCodes.OK, ResponseMessage.USERS_FETCHED, usersById);
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion
