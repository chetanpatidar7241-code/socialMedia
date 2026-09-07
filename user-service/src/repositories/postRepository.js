const Post = require('../models/Post');

// Thin wrapper around the Post model — no business logic, only data access.
function create(data) {
    return new Post(data).save();
}

function findPaginated({ skip, limit }) {
    return Post.find()
        .populate('userId', 'username residency')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean();
}

function countAll() {
    return Post.countDocuments();
}

function findByIdLite(id) {
    return Post.findById(id).select('_id');
}

function incrementCounter(postId, field) {
    return Post.findByIdAndUpdate(
        postId,
        { $inc: { [field]: 1 } },
        { new: true }
    ).select('likesCount commentsCount viewsCount');
}

// Every post by any of the given (already residency-filtered) users — backs the
// internal rankings feed handed to the Admin Service.
function findByUserIds(userIds) {
    return Post.find({ userId: { $in: userIds } }).lean();
}

module.exports = { create, findPaginated, countAll, findByIdLite, incrementCounter, findByUserIds };
