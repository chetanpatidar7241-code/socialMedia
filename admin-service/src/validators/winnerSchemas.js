const Joi = require('joi');
const { TIERS } = require('../constants');

const VALID_TIERS = Object.values(TIERS);

// :id route param. Joi's numeric conversion rejects non-numeric strings outright
// (e.g. "5abc"), which is stricter than the old `parseInt(id, 10)` + `Number.isInteger`
// check it replaces — that combination silently accepted "5abc" as 5.
const winnerIdParamsSchema = Joi.object({
    id: Joi.number().integer().required().messages({
        'number.base': 'Invalid winner id',
        'any.required': 'Invalid winner id'
    })
});

const updateKycBodySchema = Joi.object({
    status: Joi.string().valid('PASSED', 'FAILED').required().messages({
        'any.only': "status must be 'PASSED' or 'FAILED'",
        'any.required': "status must be 'PASSED' or 'FAILED'",
        'string.empty': "status must be 'PASSED' or 'FAILED'"
    })
});

const listWinnersQuerySchema = Joi.object({
    tier: Joi.string().valid(...VALID_TIERS).optional().messages({
        'any.only': `tier must be one of: ${VALID_TIERS.join(', ')}`
    }),
    category: Joi.string().optional()
});

module.exports = { winnerIdParamsSchema, updateKycBodySchema, listWinnersQuerySchema };
