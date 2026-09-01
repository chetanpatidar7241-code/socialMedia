const multer = require('multer');
const { StatusCodes } = require('http-status-codes');
const { ResponseMessage } = require('../utils/ResponseMessage');

// Buffered in memory (not disk) so the controller can sniff real content bytes
// before a single byte is written to disk under an attacker-chosen name/extension.
// Fine at this scale (50MB cap); swap for a streaming validator if uploads get large.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Cheap first-pass rejection on the client-declared mimetype. This is NOT the
    // security boundary (it's spoofable) — real validation happens on the buffer
    // in mediaValidation.detectMediaType once the file is fully received.
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        const err = new Error(ResponseMessage.INVALID_FILE_TYPE);
        err.statusCode = StatusCodes.BAD_REQUEST;
        cb(err, false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter
});

module.exports = upload;
