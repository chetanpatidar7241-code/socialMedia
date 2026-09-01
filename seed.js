const mongoose = require('mongoose');
const User = require('./user-service/src/models/User');
const Post = require('./user-service/src/models/Post');
const Interaction = require('./user-service/src/models/Interaction');

mongoose.connect('mongodb://localhost:27017/user-service');

async function seed() {
    await User.deleteMany();
    await Post.deleteMany();
    await Interaction.deleteMany();

    // 1. Ineligible user (Non-Chhattisgarh)
    const uIneligible = await new User({ username: 'outsider', passwordHash: 'hash', residency: 'Delhi' }).save();
    await new Post({ userId: uIneligible._id, mediaUrl: '/a', mediaType: 'image', category: 'Art', week: 1, score: 1000 }).save();

    // 2. Multi-category leader
    const uMulti = await new User({ username: 'multi_winner', passwordHash: 'hash', residency: 'Chhattisgarh' }).save();
    // Strongest category (Art)
    await new Post({ userId: uMulti._id, mediaUrl: '/a', mediaType: 'image', category: 'Art', week: 1, likesCount: 500, viewsCount: 1000 }).save();
    // Weaker category (Music)
    await new Post({ userId: uMulti._id, mediaUrl: '/b', mediaType: 'image', category: 'Music', week: 1, likesCount: 400, viewsCount: 1000 }).save();

    // 3. Tie score
    const uTie1 = await new User({ username: 'tie_one', passwordHash: 'hash', residency: 'Chhattisgarh' }).save();
    const uTie2 = await new User({ username: 'tie_two', passwordHash: 'hash', residency: 'Chhattisgarh' }).save();
    
    // Both score 130
    await new Post({ userId: uTie1._id, mediaUrl: '/c', mediaType: 'image', category: 'Dance', week: 1, likesCount: 100, commentsCount: 10, viewsCount: 0, createdAt: new Date('2023-01-01T10:00:00Z') }).save(); 
    // uTie2 has more comments, so should win tiebreak (30 comments vs 10 comments) - 10*1 + 40*3 = 130 vs 100*1 + 10*3 = 130
    await new Post({ userId: uTie2._id, mediaUrl: '/d', mediaType: 'image', category: 'Dance', week: 1, likesCount: 10, commentsCount: 40, viewsCount: 0, createdAt: new Date('2023-01-01T10:00:00Z') }).save();

    // 4. Miss consistency by one week
    const uMiss = await new User({ username: 'almost_consistent', passwordHash: 'hash', residency: 'Chhattisgarh' }).save();
    for (let w = 1; w <= 3; w++) { // Only 3 weeks
        for(let p=0; p<3; p++) {
            await new Post({ userId: uMiss._id, mediaUrl: '/e', mediaType: 'image', category: 'Tech', week: w, likesCount: 10 }).save();
        }
    }

    // 4b. Fully consistent user
    const uConsistent = await new User({ username: 'fully_consistent', passwordHash: 'hash', residency: 'Chhattisgarh' }).save();
    for (let w = 1; w <= 4; w++) { // All 4 weeks
        for(let p=0; p<3; p++) {
            await new Post({ userId: uConsistent._id, mediaUrl: '/cons', mediaType: 'image', category: 'Education', week: w, likesCount: 10 }).save();
        }
    }

    // 5. Exhausted category
    // Category 'Cooking' only has 1 person
    const uCooking = await new User({ username: 'cook_master', passwordHash: 'hash', residency: 'Chhattisgarh' }).save();
    await new Post({ userId: uCooking._id, mediaUrl: '/f', mediaType: 'image', category: 'Cooking', week: 1, likesCount: 50 }).save();

    console.log('Seed complete!');
    process.exit(0);
}

seed();
