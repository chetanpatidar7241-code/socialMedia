const express = require('express');
const adminAuthController = require('../controllers/adminAuthController');
const { rateLimit } = require('../middlewares/rateLimiter');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/admin/login', loginLimiter, adminAuthController.login);

module.exports = router;
