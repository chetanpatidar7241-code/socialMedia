const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const postController = require('../controllers/postController');
const internalController = require('../controllers/internalController');

const { authenticate } = require('../middlewares/authMiddleware');
const optionalAuthenticate = require('../middlewares/optionalAuthMiddleware');
const internalAuth = require('../middlewares/internalAuthMiddleware');
const { rateLimit } = require('../middlewares/rateLimiter');
const upload = require('../middlewares/uploadMiddleware');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// Auth routes
router.post('/auth/signup', authLimiter, authController.signup);
router.post('/auth/login', authLimiter, authController.login);
router.put('/auth/residency', authenticate, authController.updateResidency);

// Post routes
router.post('/posts', authenticate, upload.single('media'), postController.createPost);
router.get('/posts', optionalAuthenticate, postController.getPosts);
router.get('/posts/:postId/comments', postController.getComments);
router.post('/posts/:postId/interact', authenticate, postController.interact);

// Internal routes: consumed only by the Admin Service, guarded by a shared secret
// since architecture rules forbid the Admin Service from touching this DB directly.
router.get('/internal/rankings', internalAuth, internalController.getRankingsData);
router.get('/internal/users', internalAuth, internalController.getUsersByIds);

module.exports = router;
