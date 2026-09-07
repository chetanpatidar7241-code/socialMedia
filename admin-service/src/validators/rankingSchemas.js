const Joi = require('joi');

// `force` was previously read as `req.body?.force === true` with no validation at
// all (any non-`true` value silently meant "not forced"). This schema keeps that
// same default but now rejects a malformed value outright instead of silently
// coercing it — a minor, intentional strictness improvement.
const generateRankingsSchema = Joi.object({
    force: Joi.boolean().optional().default(false)
});

const jobIdParamsSchema = Joi.object({
    jobId: Joi.string().required().messages({
        'string.empty': 'Invalid job id',
        'any.required': 'Invalid job id'
    })
});

module.exports = { generateRankingsSchema, jobIdParamsSchema };
