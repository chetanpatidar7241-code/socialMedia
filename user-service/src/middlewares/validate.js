const { StatusCodes } = require('http-status-codes');
const { sendResponse } = require('../services/CommonService');

// Validates req[source] against a Joi schema and returns the schema's own custom
// message (see src/validators/*.js) via the existing { message, data } 400 envelope,
// so callers get byte-identical error text to the manual checks this replaces.
function validate(schema, source = 'body') {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source] || {}, {
            abortEarly: true,
            stripUnknown: true,
            convert: true
        });
        if (error) {
            return sendResponse(res, StatusCodes.BAD_REQUEST, error.details[0].message);
        }
        req[source] = value;
        next();
    };
}

module.exports = { validate };
