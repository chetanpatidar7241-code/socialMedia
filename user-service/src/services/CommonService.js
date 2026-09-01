// One place that decides the response envelope shape, so every route returns the
// same { message, data } body instead of each controller inventing its own.
function sendResponse(res, statusCode, message, data = null) {
    return res.status(statusCode).json({ message, data });
}

module.exports = { sendResponse };
