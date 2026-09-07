const Joi = require('joi');
const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const { CATEGORIES, INTERACTION_TYPES } = require('../constants');
const { sendResponse } = require('../services/CommonService');
const { ResponseMessage } = require('../utils/ResponseMessage');

// Joi has no built-in Mongo ObjectId type; wrap mongoose's own check as a custom rule
// so postId params validate the same way `isValidObjectId` used to in the controller.
const objectIdSchema = Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
    return value;
}, 'Mongo ObjectId validation');

const postIdParamsSchema = Joi.object({
    postId: objectIdSchema.required().messages({
        'any.invalid': ResponseMessage.INVALID_POST_ID,
        'any.required': ResponseMessage.INVALID_POST_ID,
        'string.empty': ResponseMessage.INVALID_POST_ID,
        'string.base': ResponseMessage.INVALID_POST_ID
    })
});

// File presence is a multer/`req.file` concern, not a body-shape concern, so it
// stays outside Joi — but as a dedicated middleware (not an inline controller `if`)
// wired ahead of `validate(createPostSchema)` so the original media-first error
// precedence is preserved.
function requireMedia(req, res, next) {
    if (!req.file) return sendResponse(res, StatusCodes.BAD_REQUEST, ResponseMessage.MEDIA_REQUIRED);
    next();
}

const createPostSchema = Joi.object({
    category: Joi.string().valid(...CATEGORIES).required()
        .messages({
            'any.only': ResponseMessage.CATEGORY_INVALID(CATEGORIES),
            'any.required': ResponseMessage.CATEGORY_INVALID(CATEGORIES),
            'string.empty': ResponseMessage.CATEGORY_INVALID(CATEGORIES),
            'string.base': ResponseMessage.CATEGORY_INVALID(CATEGORIES)
        }),
    caption: Joi.string().trim().min(1).max(500).required()
        .messages({
            'string.empty': ResponseMessage.CAPTION_REQUIRED,
            'any.required': ResponseMessage.CAPTION_REQUIRED,
            'string.base': ResponseMessage.CAPTION_REQUIRED,
            'string.min': ResponseMessage.CAPTION_REQUIRED,
            'string.max': ResponseMessage.CAPTION_TOO_LONG
        })
});

const interactBodySchema = Joi.object({
    type: Joi.string().valid(...INTERACTION_TYPES).required()
        .messages({
            'any.only': ResponseMessage.INTERACTION_TYPE_INVALID(INTERACTION_TYPES),
            'any.required': ResponseMessage.INTERACTION_TYPE_INVALID(INTERACTION_TYPES),
            'string.empty': ResponseMessage.INTERACTION_TYPE_INVALID(INTERACTION_TYPES),
            'string.base': ResponseMessage.INTERACTION_TYPE_INVALID(INTERACTION_TYPES)
        }),
    content: Joi.when('type', {
        is: 'comment',
        then: Joi.string().trim().min(1).required().messages({
            'string.empty': ResponseMessage.COMMENT_TEXT_REQUIRED,
            'any.required': ResponseMessage.COMMENT_TEXT_REQUIRED,
            'string.base': ResponseMessage.COMMENT_TEXT_REQUIRED
        }),
        otherwise: Joi.string().allow('', null).optional()
    })
});

module.exports = { postIdParamsSchema, createPostSchema, interactBodySchema, requireMedia };
