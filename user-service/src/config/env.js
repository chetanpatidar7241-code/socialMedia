const Joi = require('joi');
require('dotenv').config();

// Single place that loads .env and validates it. Every other file imports this
// module instead of touching process.env directly (see README "Config Management").
const envSchema = Joi.object({
    JWT_SECRET: Joi.string().required(),
    INTERNAL_API_KEY: Joi.string().required(),
    PORT: Joi.number().integer().positive().default(4000),
    MONGO_URI: Joi.string().default('mongodb://localhost:27017/user-service'),
    NATS_URL: Joi.string().default('nats://localhost:4222'),
    // No default here: contestWeek.js falls back to `Date.now()` (not a fixed string)
    // when this is unset, so the fallback must stay in contestWeek.js itself.
    CONTEST_START_DATE: Joi.string().optional()
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
    jwtSecret: envVars.JWT_SECRET,
    internalApiKey: envVars.INTERNAL_API_KEY,
    mongoUri: envVars.MONGO_URI,
    natsUrl: envVars.NATS_URL,
    contestStartDate: envVars.CONTEST_START_DATE
});
