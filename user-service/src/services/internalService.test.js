const mongoose = require('mongoose');

jest.mock('../repositories/userRepository');
jest.mock('../repositories/postRepository');

const userRepository = require('../repositories/userRepository');
const postRepository = require('../repositories/postRepository');
const internalService = require('./internalService');

afterEach(() => jest.clearAllMocks());

describe('getUsersByIds', () => {
    test('throws a 400 AppError when ids is missing', async () => {
        await expect(internalService.getUsersByIds()).rejects.toMatchObject({ statusCode: 400 });
    });

    test('throws a 400 AppError when ids is an empty array', async () => {
        await expect(internalService.getUsersByIds([])).rejects.toMatchObject({ statusCode: 400 });
    });

    test('dedupes, drops invalid ObjectIds, and shapes the result by id', async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        userRepository.findByIds.mockResolvedValue([{ _id: validId, username: 'alice' }]);

        const result = await internalService.getUsersByIds([validId, validId, 'not-an-id']);

        expect(userRepository.findByIds).toHaveBeenCalledWith([validId]);
        expect(result).toEqual({ [validId]: { username: 'alice' } });
    });
});

describe('getRankingsData', () => {
    function makePost(userId, week, likes, comments, views) {
        return {
            _id: new mongoose.Types.ObjectId(),
            userId,
            category: 'Art',
            likesCount: likes,
            commentsCount: comments,
            viewsCount: views,
            createdAt: new Date(),
            week
        };
    }

    test('computes score as likes*1 + comments*3 + views*0.2 for every post', async () => {
        const userId = new mongoose.Types.ObjectId();
        userRepository.findByResidency.mockResolvedValue([{ _id: userId, residency: 'Chhattisgarh' }]);
        postRepository.findByUserIds.mockResolvedValue([makePost(userId, 1, 10, 2, 5)]);

        const result = await internalService.getRankingsData();

        expect(result.posts[0].score).toBe(10 * 1 + 2 * 3 + 5 * 0.2);
        expect(result.posts[0].userId).toBe(userId.toString());
        expect(result.posts[0].residency).toBe('Chhattisgarh');
    });

    test('marks a user inconsistent when any week has fewer than 3 posts, scoring 0', async () => {
        const userId = new mongoose.Types.ObjectId();
        userRepository.findByResidency.mockResolvedValue([{ _id: userId, residency: 'Chhattisgarh' }]);
        postRepository.findByUserIds.mockResolvedValue([
            makePost(userId, 1, 10, 0, 0),
            makePost(userId, 1, 5, 0, 0),
            makePost(userId, 1, 1, 0, 0)
            // weeks 2-4 have zero posts
        ]);

        const result = await internalService.getRankingsData();

        expect(result.consistency[0].isConsistent).toBe(false);
        expect(result.consistency[0].totalConsistencyScore).toBe(0);
    });

    test('marks a user consistent when every week has 3+ posts, summing top-3-per-week scores', async () => {
        const userId = new mongoose.Types.ObjectId();
        userRepository.findByResidency.mockResolvedValue([{ _id: userId, residency: 'Chhattisgarh' }]);

        const posts = [];
        for (let week = 1; week <= 4; week++) {
            posts.push(makePost(userId, week, 10, 0, 0)); // score 10
            posts.push(makePost(userId, week, 5, 0, 0)); // score 5
            posts.push(makePost(userId, week, 1, 0, 0)); // score 1
        }
        postRepository.findByUserIds.mockResolvedValue(posts);

        const result = await internalService.getRankingsData();

        expect(result.consistency[0].isConsistent).toBe(true);
        // top-3 sum per week = 10+5+1 = 16, across 4 weeks = 64
        expect(result.consistency[0].totalConsistencyScore).toBe(64);
    });
});
