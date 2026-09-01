const express = require('express');
const cors = require('cors');

const adminAuthRoutes = require('./routes/adminAuthRoutes');
const winnersRoutes = require('./routes/winnersRoutes');
const rankingRoutes = require('./routes/rankingRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', adminAuthRoutes);
app.use('/api', winnersRoutes);
app.use('/api', rankingRoutes);

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Centralized error handler — anything passed to next(err) lands here instead of
// leaking raw error.message/stacks to clients from scattered catch blocks.
app.use((err, req, res, next) => {
    if (err) {
        console.error(err);
        return res.status(err.statusCode || 500).json({ message: err.statusCode ? err.message : 'Internal server error' });
    }
    next();
});

module.exports = app;
