const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { RESIDENCY_OPTIONS } = require("../constants");
const { sendError } = require("../utils/AppError");
const { sendResponse } = require("../services/CommonService");
const { ResponseMessage } = require("../utils/ResponseMessage");

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function signToken(user) {
  return jwt.sign(
    { userId: user._id, residency: user.residency },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

function toPublicUser(user) {
  return { id: user._id, username: user.username, residency: user.residency };
}

// #region signup api
exports.signup = async (req, res) => {
  try {
    const { username, password, residency } = req.body;

    if (
      !isNonEmptyString(username) ||
      !isNonEmptyString(password) ||
      !isNonEmptyString(residency)
    ) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED
      );
    }
    if (username.trim().length < 3 || username.trim().length > 30) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.USERNAME_LENGTH_INVALID
      );
    }
    if (password.length < 6) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.PASSWORD_LENGTH_INVALID
      );
    }
    if (!RESIDENCY_OPTIONS.includes(residency)) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.INVALID_RESIDENCY
      );
    }

    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return sendResponse(
        res,
        StatusCodes.CONFLICT,
        ResponseMessage.USERNAME_TAKEN
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      username: username.trim(),
      passwordHash,
      residency,
    });
    await user.save();

    const token = signToken(user);
    sendResponse(res, StatusCodes.CREATED, ResponseMessage.SIGNUP_SUCCESS, {
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse(
        res,
        StatusCodes.CONFLICT,
        ResponseMessage.USERNAME_TAKEN
      );
    }
    if (error.name === "ValidationError") {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        Object.values(error.errors)[0].message
      );
    }
    sendError(res, error);
  }
};
// #endregion

// #region login api
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.USERNAME_PASSWORD_REQUIRED
      );
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user)
      return sendResponse(
        res,
        StatusCodes.UNAUTHORIZED,
        ResponseMessage.INVALID_CREDENTIALS
      );

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return sendResponse(
        res,
        StatusCodes.UNAUTHORIZED,
        ResponseMessage.INVALID_CREDENTIALS
      );

    const token = signToken(user);
    sendResponse(res, StatusCodes.OK, ResponseMessage.LOGIN_SUCCESS, {
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion

// #region update residency api
exports.updateResidency = async (req, res) => {
  try {
    const { residency } = req.body;
    if (
      !isNonEmptyString(residency) ||
      !RESIDENCY_OPTIONS.includes(residency)
    ) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.INVALID_RESIDENCY
      );
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { residency },
      { new: true, runValidators: true }
    );
    if (!user)
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        ResponseMessage.USER_NOT_FOUND
      );

    sendResponse(res, StatusCodes.OK, ResponseMessage.RESIDENCY_UPDATED, {
      user: toPublicUser(user),
    });
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion
