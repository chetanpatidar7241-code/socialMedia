// Centralized response message strings so every controller returns consistent wording
// instead of each route inventing its own phrasing. Entries that need to interpolate
// a value (e.g. the fixed category list) are functions instead of plain strings.
const ResponseMessage = {
    // Auth
    USERNAME_PASSWORD_RESIDENCY_REQUIRED: 'username, password and residency are all required strings',
    USERNAME_LENGTH_INVALID: 'Username must be between 3 and 30 characters',
    PASSWORD_LENGTH_INVALID: 'Password must be at least 6 characters',
    INVALID_RESIDENCY: 'Invalid residency value',
    USERNAME_TAKEN: 'Username already taken',
    SIGNUP_SUCCESS: 'User created successfully',
    LOGIN_SUCCESS: 'Login successful',
    USERNAME_PASSWORD_REQUIRED: 'username and password are required',
    INVALID_CREDENTIALS: 'Invalid credentials',
    USER_NOT_FOUND: 'User not found',
    RESIDENCY_UPDATED: 'Residency updated',

    // Posts
    MEDIA_REQUIRED: 'Media file is required',
    CATEGORY_INVALID: (categories) => `Category must be one of: ${categories.join(', ')}`,
    CAPTION_REQUIRED: 'Caption is required',
    CAPTION_TOO_LONG: 'Caption must be 500 characters or fewer',
    POST_CREATED: 'Post created successfully',
    POSTS_FETCHED: 'Posts fetched successfully',
    COMMENTS_FETCHED: 'Comments fetched successfully',

    // Interactions
    INVALID_POST_ID: 'Invalid post id',
    INTERACTION_TYPE_INVALID: (types) => `Interaction type must be one of: ${types.join(', ')}`,
    COMMENT_TEXT_REQUIRED: 'Comment text is required',
    POST_NOT_FOUND: 'Post not found',
    INTERACTION_RECORDED: 'Interaction recorded',
    ALREADY_INTERACTED: (type) => `You already ${type === 'view' ? 'viewed' : 'liked'} this post`,

    // Auth middleware
    NO_TOKEN_PROVIDED: 'No token provided',
    INVALID_TOKEN: 'Invalid token',

    // Internal API (NATS request/reply, consumed only by the Admin Service)
    UNAUTHORIZED: 'Unauthorized',
    RANKINGS_FETCHED: 'Ranking data fetched successfully',
    USER_IDS_REQUIRED: 'ids field is required (a non-empty array of user ids)',
    USERS_FETCHED: 'Users fetched successfully',

    // Uploads
    INVALID_FILE_TYPE: 'Invalid file type. Only images and videos are allowed.',
    FILE_TOO_LARGE: 'File exceeds the 50MB size limit',
    UNSUPPORTED_MEDIA_CONTENT: 'Uploaded file content does not match a supported image or video format',

    // Generic
    ROUTE_NOT_FOUND: 'Route not found',
    TOO_MANY_REQUESTS: 'Too many requests, please try again later',
    INTERNAL_SERVER_ERROR: 'Internal server error'
};

module.exports = { ResponseMessage };
