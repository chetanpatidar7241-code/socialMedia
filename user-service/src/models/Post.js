const mongoose = require('mongoose');
const { CATEGORIES } = require('../constants');

const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    caption: { type: String, trim: true, maxlength: 500 },
    category: { type: String, required: true, enum: CATEGORIES },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    viewsCount: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now },
    week: { type: Number, required: true, min: 1, max: 4 } // contest week (1-4), set from server-side contest calendar
});

// Indexes for optimized querying by admin service / feed / ranking engine
postSchema.index({ category: 1, likesCount: -1 });
postSchema.index({ userId: 1, week: 1 });
postSchema.index({ createdAt: -1 }); // feed default sort
postSchema.index({ category: 1, userId: 1 }); // per-category best-post-per-creator lookups

module.exports = mongoose.model('Post', postSchema);
