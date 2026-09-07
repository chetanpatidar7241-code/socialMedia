const User = require('../models/User');

// Thin wrapper around the User model — no business logic, only data access.
function findByUsername(username) {
    return User.findOne({ username });
}

function createUser({ username, passwordHash, residency }) {
    return new User({ username, passwordHash, residency }).save();
}

function updateResidencyById(id, residency) {
    return User.findByIdAndUpdate(id, { residency }, { new: true, runValidators: true });
}

// Contest-eligibility lookup used by the internal rankings feed (only one residency
// is currently eligible, but this stays residency-agnostic at the data layer).
function findByResidency(residency) {
    return User.find({ residency }).select('_id residency');
}

function findByIds(ids) {
    return User.find({ _id: { $in: ids } }).select('_id username');
}

module.exports = { findByUsername, createUser, updateResidencyById, findByResidency, findByIds };
