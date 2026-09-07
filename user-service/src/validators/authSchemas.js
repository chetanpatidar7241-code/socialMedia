const Joi = require('joi');
const { RESIDENCY_OPTIONS } = require('../constants');
const { ResponseMessage } = require('../utils/ResponseMessage');

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

// Shape/format/length/enum validation only. DB-backed rules (username uniqueness,
// user existence) stay in the controller/service layer, since Joi has no DB access.
const signupSchema = Joi.object({
    username: Joi.string().trim().min(3).max(30).pattern(USERNAME_PATTERN).required()
        .messages({
            'string.empty': ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED,
            'any.required': ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED,
            'string.base': ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED,
            'string.min': ResponseMessage.USERNAME_LENGTH_INVALID,
            'string.max': ResponseMessage.USERNAME_LENGTH_INVALID,
            'string.pattern.base': 'Username may only contain letters, numbers, underscores and dots'
        }),
    password: Joi.string().min(6).required()
        .messages({
            'string.empty': ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED,
            'any.required': ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED,
            'string.base': ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED,
            'string.min': ResponseMessage.PASSWORD_LENGTH_INVALID
        }),
    residency: Joi.string().valid(...RESIDENCY_OPTIONS).required()
        .messages({
            'string.empty': ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED,
            'any.required': ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED,
            'string.base': ResponseMessage.USERNAME_PASSWORD_RESIDENCY_REQUIRED,
            'any.only': ResponseMessage.INVALID_RESIDENCY
        })
});

const loginSchema = Joi.object({
    username: Joi.string().trim().required()
        .messages({
            'string.empty': ResponseMessage.USERNAME_PASSWORD_REQUIRED,
            'any.required': ResponseMessage.USERNAME_PASSWORD_REQUIRED,
            'string.base': ResponseMessage.USERNAME_PASSWORD_REQUIRED
        }),
    password: Joi.string().required()
        .messages({
            'string.empty': ResponseMessage.USERNAME_PASSWORD_REQUIRED,
            'any.required': ResponseMessage.USERNAME_PASSWORD_REQUIRED,
            'string.base': ResponseMessage.USERNAME_PASSWORD_REQUIRED
        })
});

const updateResidencySchema = Joi.object({
    residency: Joi.string().valid(...RESIDENCY_OPTIONS).required()
        .messages({
            'string.empty': ResponseMessage.INVALID_RESIDENCY,
            'any.required': ResponseMessage.INVALID_RESIDENCY,
            'string.base': ResponseMessage.INVALID_RESIDENCY,
            'any.only': ResponseMessage.INVALID_RESIDENCY
        })
});

module.exports = { signupSchema, loginSchema, updateResidencySchema };
