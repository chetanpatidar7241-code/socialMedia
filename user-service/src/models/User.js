const mongoose = require('mongoose');
const { RESIDENCY_OPTIONS } = require('../constants');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30,
        match: [/^[a-zA-Z0-9_.]+$/, 'Username may only contain letters, numbers, underscores and dots']
    },
    passwordHash: { type: String, required: true },
    residency: { type: String, required: true, enum: RESIDENCY_OPTIONS },
    createdAt: { type: Date, default: Date.now }
});

// Primary filter used by the internal ranking API (contest eligibility check).
userSchema.index({ residency: 1 });

module.exports = mongoose.model('User', userSchema);
