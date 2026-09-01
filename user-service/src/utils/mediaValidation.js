// Real content-based validation instead of trusting the client-supplied mimetype/
// filename extension (both are trivially spoofable in multipart form data). We sniff
// the file's magic bytes and derive the extension ourselves, so a malicious file
// mislabeled as an image can't be stored/served as one.

function matchesSignature(buffer, offset, signature) {
    if (buffer.length < offset + signature.length) return false;
    for (let i = 0; i < signature.length; i++) {
        if (buffer[offset + i] !== signature[i]) return false;
    }
    return true;
}

const SIGNATURES = [
    { mediaType: 'image', ext: '.jpg', test: (b) => matchesSignature(b, 0, [0xff, 0xd8, 0xff]) },
    { mediaType: 'image', ext: '.png', test: (b) => matchesSignature(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
    { mediaType: 'image', ext: '.gif', test: (b) => matchesSignature(b, 0, [0x47, 0x49, 0x46, 0x38]) },
    {
        mediaType: 'image', ext: '.webp',
        test: (b) => matchesSignature(b, 0, [0x52, 0x49, 0x46, 0x46]) && matchesSignature(b, 8, [0x57, 0x45, 0x42, 0x50])
    },
    { mediaType: 'video', ext: '.webm', test: (b) => matchesSignature(b, 0, [0x1a, 0x45, 0xdf, 0xa3]) },
    {
        mediaType: 'video', ext: '.avi',
        test: (b) => matchesSignature(b, 0, [0x52, 0x49, 0x46, 0x46]) && matchesSignature(b, 8, [0x41, 0x56, 0x49, 0x20])
    },
    // MP4/MOV/M4V family all use an ISO base media "ftyp" box starting at byte 4.
    { mediaType: 'video', ext: '.mp4', test: (b) => matchesSignature(b, 4, [0x66, 0x74, 0x79, 0x70]) }
];

function detectMediaType(buffer) {
    for (const sig of SIGNATURES) {
        if (sig.test(buffer)) return { mediaType: sig.mediaType, ext: sig.ext };
    }
    return null;
}

module.exports = { detectMediaType };
