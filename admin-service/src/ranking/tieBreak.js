// Score = Likes*1 + Comments*3 + Views*0.2 tie-break order: Comments desc -> Views desc -> earliest timestamp.
function compareByScore(a, b) {
    return (
        b.score - a.score ||
        (b.comments || 0) - (a.comments || 0) ||
        (b.views || 0) - (a.views || 0) ||
        new Date(a.createdAt) - new Date(b.createdAt)
    );
}

module.exports = { compareByScore };
