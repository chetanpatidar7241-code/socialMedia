const config = require('../config/env');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Contest week is derived server-side from a fixed contest start date rather than
// trusted from client input, so a post's week can't be spoofed to game the
// consistency ranking. Falls back to "now" if unset, so a fresh deployment starts week 1.
const CONTEST_START_DATE = new Date(config.contestStartDate || Date.now());

function getContestWeek(date = new Date()) {
    const diff = date.getTime() - CONTEST_START_DATE.getTime();
    const week = Math.floor(diff / WEEK_MS) + 1;
    return Math.min(4, Math.max(1, week));
}

module.exports = { getContestWeek, CONTEST_START_DATE };
