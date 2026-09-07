const Joi = require('joi');
require('dotenv').config();

// Single place that loads .env and validates it. Every other file imports this
// module instead of touching process.env directly (see README "Config Management").
const envSchema = Joi.object({
    DATABASE_URL: Joi.string().required(),
    ADMIN_JWT_SECRET: Joi.string().required(),
    INTERNAL_API_KEY: Joi.string().required(),
    PORT: Joi.number().integer().positive().default(5000),
    NATS_URL: Joi.string().default('nats://localhost:4222'),
    REDIS_URL: Joi.string().default('redis://localhost:6379')
}).unknown(true); // don't choke on unrelated OS/npm env vars

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
    // Same fail-fast behavior as the old index.js loop: report the first missing/
    // invalid required variable and exit immediately, one message, no partial startup.
    console.error(`Missing required environment variable: ${error.details[0].context.key}`);
    process.exit(1);
}

module.exports = Object.freeze({
    port: envVars.PORT,
    databaseUrl: envVars.DATABASE_URL,
    adminJwtSecret: envVars.ADMIN_JWT_SECRET,
    internalApiKey: envVars.INTERNAL_API_KEY,
    natsUrl: envVars.NATS_URL,
    redisUrl: envVars.REDIS_URL
});
