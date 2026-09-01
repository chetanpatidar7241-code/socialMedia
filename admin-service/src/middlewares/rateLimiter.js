// Minimal in-memory fixed-window limiter (no extra dependency) to blunt brute-force
// against the admin login endpoint. Not distributed-safe — fine for a single instance.
function rateLimit({ windowMs, max }) {
    const hits = new Map();

    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        let entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;

        if (entry.count > max) {
            res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({ message: 'Too many requests, please try again later' });
        }
        next();
    };
}

module.exports = { rateLimit };
