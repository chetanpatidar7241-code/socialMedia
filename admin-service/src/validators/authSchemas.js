const Joi = require('joi');

// Shape validation only. Credential matching (DB lookup + bcrypt compare) stays in
// the controller — Joi has no DB access and must never see a plaintext/hash compare.
const loginSchema = Joi.object({
    username: Joi.string().required().messages({
        'string.empty': 'username and password are required',
        'any.required': 'username and password are required',
        'string.base': 'username and password are required'
    }),
    password: Joi.string().required().messages({
        'string.empty': 'username and password are required',
        'any.required': 'username and password are required',
        'string.base': 'username and password are required'
    })
});

module.exports = { loginSchema };
