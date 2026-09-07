const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const config = require('../config/env');
const userRepository = require('../repositories/userRepository');
const { AppError } = require('../utils/AppError');
const { ResponseMessage } = require('../utils/ResponseMessage');

function signToken(user) {
    return jwt.sign(
        { userId: user._id, residency: user.residency },
        config.jwtSecret,
        { expiresIn: '1d' }
    );
}

function toPublicUser(user) {
    return { id: user._id, username: user.username, residency: user.residency };
}

// Shape/format/length/enum validation already ran in validate(signupSchema) at the
// route level (see routes/index.js) — this only orchestrates the DB-backed rules
// (uniqueness) and the actual account creation.
async function signup({ username, password, residency }) {
    const existingUser = await userRepository.findByUsername(username);
    if (existingUser) {
        throw new AppError(StatusCodes.CONFLICT, ResponseMessage.USERNAME_TAKEN);
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await userRepository.createUser({ username, passwordHash, residency });
        return { token: signToken(user), user: toPublicUser(user) };
    } catch (error) {
        // Defense in depth: a concurrent signup racing past the findByUsername check
        // above still hits the model's unique index, surfaced here as a Mongo 11000.
        if (error.code === 11000) {
            throw new AppError(StatusCodes.CONFLICT, ResponseMessage.USERNAME_TAKEN);
        }
        if (error.name === 'ValidationError') {
            throw new AppError(StatusCodes.BAD_REQUEST, Object.values(error.errors)[0].message);
        }
        throw error;
    }
}

async function login({ username, password }) {
    const user = await userRepository.findByUsername(username);
    if (!user) throw new AppError(StatusCodes.UNAUTHORIZED, ResponseMessage.INVALID_CREDENTIALS);

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new AppError(StatusCodes.UNAUTHORIZED, ResponseMessage.INVALID_CREDENTIALS);

    return { token: signToken(user), user: toPublicUser(user) };
}

async function updateResidency(userId, residency) {
    const user = await userRepository.updateResidencyById(userId, residency);
    if (!user) throw new AppError(StatusCodes.NOT_FOUND, ResponseMessage.USER_NOT_FOUND);
    return toPublicUser(user);
}

module.exports = { signup, login, updateResidency };
