const Interaction = require('../models/Interaction');

// Thin wrapper around the Interaction model — no business logic, only data access.
function create(data) {
    return new Interaction(data).save();
}

// Which of the given postIds this user has already liked — backs the feed's
// "likedByMe" flag so a page refresh doesn't reset an already-liked post's button.
function findLikedPostIds({ userId, postIds }) {
    return Interaction.find({ userId, type: 'like', postId: { $in: postIds } })
        .select('postId')
        .lean();
}

function findCommentsByPost(postId) {
    return Interaction.find({ postId, type: 'comment' })
        .populate('userId', 'username')
        .sort('-createdAt')
        .limit(200);
}

module.exports = { create, findLikedPostIds, findCommentsByPost };
