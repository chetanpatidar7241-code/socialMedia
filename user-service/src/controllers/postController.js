const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Post = require("../models/Post");
const Interaction = require("../models/Interaction");
const { CATEGORIES, INTERACTION_TYPES } = require("../constants");
const { getContestWeek } = require("../utils/contestWeek");
const { storeMediaBuffer } = require("../utils/storeMedia");
const { sendError } = require("../utils/AppError");
const { sendResponse } = require("../services/CommonService");
const { ResponseMessage } = require("../utils/ResponseMessage");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// #region Create Post
exports.createPost = async (req, res) => {
  try {
    const { caption, category } = req.body;

    if (!req.file)
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.MEDIA_REQUIRED
      );
    if (!CATEGORIES.includes(category)) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.CATEGORY_INVALID(CATEGORIES)
      );
    }
    if (typeof caption !== "string" || caption.trim().length === 0) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.CAPTION_REQUIRED
      );
    }
    if (caption.length > 500) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.CAPTION_TOO_LONG
      );
    }

    const { mediaType, mediaUrl } = storeMediaBuffer(req.file.buffer);

    const post = new Post({
      userId: req.user.userId,
      mediaUrl,
      mediaType,
      caption: caption.trim(),
      category,
      week: getContestWeek(),
    });
    await post.save();
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

    const [posts, total] = await Promise.all([
      Post.find()
        .populate("userId", "username residency")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Post.countDocuments(),
    ]);

    // Tell the client which of these posts the current viewer already liked, so a
    // page refresh doesn't reset the "Liked" button back to an un-liked look while
    // the like itself is still recorded server-side.
    let likedPostIds = new Set();
    if (req.user) {
      const likes = await Interaction.find({
        userId: req.user.userId,
        type: "like",
        postId: { $in: posts.map((p) => p._id) },
      })
        .select("postId")
        .lean();
      likedPostIds = new Set(likes.map((l) => l.postId.toString()));
    }
    const postsWithLikeState = posts.map((p) => ({
      ...p,
      likedByMe: likedPostIds.has(p._id.toString()),
    }));

    sendResponse(res, StatusCodes.OK, ResponseMessage.POSTS_FETCHED, {
      posts: postsWithLikeState,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    sendError(res, error);
  }
};
// #endregion

// #region Get Comments
exports.getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!isValidObjectId(postId))
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.INVALID_POST_ID
      );

    const post = await Post.findById(postId).select("_id");
    if (!post)
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        ResponseMessage.POST_NOT_FOUND
      );

    const comments = await Interaction.find({ postId, type: "comment" })
      .populate("userId", "username")
      .sort("-createdAt")
      .limit(200);

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
    const { postId } = req.params;
    const { type, content } = req.body;

    if (!isValidObjectId(postId))
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.INVALID_POST_ID
      );
    if (!INTERACTION_TYPES.includes(type)) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.INTERACTION_TYPE_INVALID(INTERACTION_TYPES)
      );
    }
    if (
      type === "comment" &&
      (typeof content !== "string" || content.trim().length === 0)
    ) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        ResponseMessage.COMMENT_TEXT_REQUIRED
      );
    }

    const post = await Post.findById(postId).select("_id");
    if (!post)
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        ResponseMessage.POST_NOT_FOUND
      );

    const interaction = new Interaction({
      postId,
      userId: req.user.userId,
      type,
      content: type === "comment" ? content.trim() : undefined,
    });
    await interaction.save();

    const updateField = `${type}sCount`;
    const updated = await Post.findByIdAndUpdate(
      postId,
      { $inc: { [updateField]: 1 } },
      { new: true }
    ).select("likesCount commentsCount viewsCount");

    sendResponse(
      res,
      StatusCodes.CREATED,
      ResponseMessage.INTERACTION_RECORDED,
      { counts: updated }
    );
  } catch (error) {
    if (error.code === 11000) {
      return sendResponse(
        res,
        StatusCodes.CONFLICT,
        ResponseMessage.ALREADY_INTERACTED(req.body.type)
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
