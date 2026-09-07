const express = require('express');
const adminAuthController = require('../controllers/adminAuthController');
const { rateLimit } = require('../middlewares/rateLimiter');
const { validate } = require('../middlewares/validate');
const { loginSchema } = require('../validators/authSchemas');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/admin/login', loginLimiter, validate(loginSchema), adminAuthController.login);

module.exports = router;
