require('dotenv').config();

['DATABASE_URL', 'ADMIN_JWT_SECRET', 'INTERNAL_API_KEY'].forEach((key) => {
    if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
});

const app = require('./src/app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Admin service on port ${PORT}`));
