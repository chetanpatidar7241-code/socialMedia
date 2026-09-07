const { StatusCodes } = require("http-status-codes");
const authService = require("../services/authService");
const { sendError } = require("../utils/AppError");
const { sendResponse } = require("../services/CommonService");
const { ResponseMessage } = require("../utils/ResponseMessage");

// #region signup api
exports.signup = async (req, res) => {
  try {
    const { username, password, residency } = req.body;
    const result = await authService.signup({ username, password, residency });
    sendResponse(res, StatusCodes.CREATED, ResponseMessage.SIGNUP_SUCCESS, result);
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion

// #region login api
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login({ username, password });
    sendResponse(res, StatusCodes.OK, ResponseMessage.LOGIN_SUCCESS, result);
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion

// #region update residency api
exports.updateResidency = async (req, res) => {
  try {
    const { residency } = req.body;
    const user = await authService.updateResidency(req.user.userId, residency);
    sendResponse(res, StatusCodes.OK, ResponseMessage.RESIDENCY_UPDATED, { user });
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion
