const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { StatusCodes } = require('http-status-codes');
const { detectMediaType } = require('./mediaValidation');
const { ResponseMessage } = require('./ResponseMessage');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

// Persists an already-validated upload buffer under uploads/<image|video>s/<YYYY-MM>/<random>.ext
// and returns the public URL + detected media type. Throws if the content doesn't match
// a known image/video signature, so callers must handle that as a 400, not a 500.
function storeMediaBuffer(buffer) {
    const detected = detectMediaType(buffer);
    if (!detected) {
        const err = new Error(ResponseMessage.UNSUPPORTED_MEDIA_CONTENT);
        err.statusCode = StatusCodes.BAD_REQUEST;
        throw err;
    }

    const { mediaType, ext } = detected;
    const folder = `${mediaType}s`; // "images" | "videos"
    const monthDir = new Date().toISOString().slice(0, 7); // YYYY-MM
    const destDir = path.join(UPLOAD_ROOT, folder, monthDir);
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(destDir, filename), buffer);

    return {
        mediaType,
        mediaUrl: `/uploads/${folder}/${monthDir}/${filename}`
    };
}

module.exports = { storeMediaBuffer };
