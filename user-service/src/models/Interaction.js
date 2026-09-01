const mongoose = require('mongoose');
const { INTERACTION_TYPES } = require('../constants');

const interactionSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: INTERACTION_TYPES, required: true },
    content: {
        type: String,
        trim: true,
        maxlength: 1000,
        required: [function () { return this.type === 'comment'; }, 'Comment text is required']
    },
    createdAt: { type: Date, default: Date.now }
});

// Prevent double likes / double views by the same user on the same post via an
// atomic unique-index violation (race-safe, unlike a read-then-write check).
// Deliberately scoped to like/view only: a user may legitimately post many comments,
// and a blanket unique index on {postId,userId,type} would (and previously did) cap
// them at one comment per post ever.
interactionSchema.index(
    { postId: 1, userId: 1, type: 1 },
    { unique: true, partialFilterExpression: { type: { $in: ['like', 'view'] } } }
);

// Admin/consumer lookups: all interactions for a post, and a user's comments feed.
interactionSchema.index({ postId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Interaction', interactionSchema);
