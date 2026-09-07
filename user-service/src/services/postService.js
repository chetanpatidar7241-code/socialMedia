const { StatusCodes } = require('http-status-codes');
const postRepository = require('../repositories/postRepository');
const interactionRepository = require('../repositories/interactionRepository');
const { getContestWeek } = require('../utils/contestWeek');
const { storeMediaBuffer } = require('../utils/storeMedia');
const { AppError } = require('../utils/AppError');
const { ResponseMessage } = require('../utils/ResponseMessage');

// Media presence and caption/category shape are already validated (requireMedia +
// validate(createPostSchema) in routes/index.js) — this only computes the
// server-owned fields (media type/url, contest week) and persists the post.
async function createPost({ userId, file, caption, category }) {
    const { mediaType, mediaUrl } = storeMediaBuffer(file.buffer);
    return postRepository.create({
        userId,
        mediaUrl,
        mediaType,
        caption,
        category,
        week: getContestWeek()
    });
}

async function getPosts({ page, limit, viewerUserId }) {
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
        postRepository.findPaginated({ skip, limit }),
        postRepository.countAll()
    ]);

    let likedPostIds = new Set();
    if (viewerUserId) {
        const likes = await interactionRepository.findLikedPostIds({
            userId: viewerUserId,
            postIds: posts.map((p) => p._id)
        });
        likedPostIds = new Set(likes.map((l) => l.postId.toString()));
    }

    const postsWithLikeState = posts.map((p) => ({
        ...p,
        likedByMe: likedPostIds.has(p._id.toString())
    }));

    return {
        posts: postsWithLikeState,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
    };
}

async function getComments(postId) {
    const post = await postRepository.findByIdLite(postId);
    if (!post) throw new AppError(StatusCodes.NOT_FOUND, ResponseMessage.POST_NOT_FOUND);
    return interactionRepository.findCommentsByPost(postId);
}

async function interact({ postId, userId, type, content }) {
    const post = await postRepository.findByIdLite(postId);
    if (!post) throw new AppError(StatusCodes.NOT_FOUND, ResponseMessage.POST_NOT_FOUND);

    try {
        await interactionRepository.create({
            postId,
            userId,
            type,
            content: type === 'comment' ? content : undefined
        });
    } catch (error) {
        // The partial unique index on {postId,userId,type} (like/view only) is the
        // actual race-safe guard against double interactions — this just translates
        // its violation into the documented 409.
        if (error.code === 11000) {
            throw new AppError(StatusCodes.CONFLICT, ResponseMessage.ALREADY_INTERACTED(type));
        }
        if (error.name === 'ValidationError') {
            throw new AppError(StatusCodes.BAD_REQUEST, Object.values(error.errors)[0].message);
        }
        throw error;
    }

    const updateField = `${type}sCount`;
    return postRepository.incrementCounter(postId, updateField);
}

module.exports = { createPost, getPosts, getComments, interact };
