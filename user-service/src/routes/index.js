const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const postController = require('../controllers/postController');

const { authenticate } = require('../middlewares/authMiddleware');
const optionalAuthenticate = require('../middlewares/optionalAuthMiddleware');
const { rateLimit } = require('../middlewares/rateLimiter');
const upload = require('../middlewares/uploadMiddleware');
const { validate } = require('../middlewares/validate');
const { signupSchema, loginSchema, updateResidencySchema } = require('../validators/authSchemas');
const { postIdParamsSchema, createPostSchema, interactBodySchema, requireMedia } = require('../validators/postSchemas');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// Auth routes
router.post('/auth/signup', authLimiter, validate(signupSchema), authController.signup);
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
router.put('/auth/residency', authenticate, validate(updateResidencySchema), authController.updateResidency);

// Post routes
router.post('/posts', authenticate, upload.single('media'), requireMedia, validate(createPostSchema), postController.createPost);
router.get('/posts', optionalAuthenticate, postController.getPosts);
router.get('/posts/:postId/comments', validate(postIdParamsSchema, 'params'), postController.getComments);
router.post(
    '/posts/:postId/interact',
    authenticate,
    validate(postIdParamsSchema, 'params'),
    validate(interactBodySchema),
    postController.interact
);

// The old HTTP internal routes (/internal/rankings, /internal/users) are retired —
// the Admin Service now reaches this data via NATS request/reply
// (see src/messaging/internalSubscriber.js), not an HTTP call.

module.exports = router;
