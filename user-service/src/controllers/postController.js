const { StatusCodes } = require("http-status-codes");
const postService = require("../services/postService");
const { sendError } = require("../utils/AppError");
const { sendResponse } = require("../services/CommonService");
const { ResponseMessage } = require("../utils/ResponseMessage");

// #region Create Post
exports.createPost = async (req, res) => {
  try {
    const { caption, category } = req.body;
    const post = await postService.createPost({
      userId: req.user.userId,
      file: req.file,
      caption,
      category,
    });
    sendResponse(res, StatusCodes.CREATED, ResponseMessage.POST_CREATED, post);
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion

// #region Get Posts and Comments
exports.getPosts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    const result = await postService.getPosts({
      page,
      limit,
      viewerUserId: req.user?.userId,
    });

    sendResponse(res, StatusCodes.OK, ResponseMessage.POSTS_FETCHED, result);
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion

// #region Get Comments
exports.getComments = async (req, res) => {
  try {
    const comments = await postService.getComments(req.params.postId);
    sendResponse(
      res,
      StatusCodes.OK,
      ResponseMessage.COMMENTS_FETCHED,
      comments
    );
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion

// #region Interact with Post (like, view, comment)
exports.interact = async (req, res) => {
  try {
    const { type, content } = req.body;
    const counts = await postService.interact({
      postId: req.params.postId,
      userId: req.user.userId,
      type,
      content,
    });
    sendResponse(
      res,
      StatusCodes.CREATED,
      ResponseMessage.INTERACTION_RECORDED,
      { counts }
    );
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion
