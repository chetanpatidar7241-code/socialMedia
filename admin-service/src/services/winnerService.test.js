jest.mock('../repositories/winnerRepository');

const winnerRepository = require('../repositories/winnerRepository');
const winnerService = require('./winnerService');

afterEach(() => jest.clearAllMocks());

// The rest of winnerService.js (generateInitialRankings, markKycFailedWithCascade) is
// integration-level — a real Prisma transaction against Postgres — and stays
// untested at the unit level per the README's existing Assumptions/Tests notes.
// assertRankingsNotYetGenerated is new, pure guard logic extracted specifically so
// rankingController can run it synchronously before enqueueing a ranking job
// (Prompt 6), so it's worth covering directly.
describe('assertRankingsNotYetGenerated', () => {
    test('does not throw when no winners exist yet', async () => {
        winnerRepository.count.mockResolvedValue(0);

        await expect(winnerService.assertRankingsNotYetGenerated({ force: false })).resolves.toBeUndefined();
    });

    test('throws a 409 AppError when winners already exist and force is not set', async () => {
        winnerRepository.count.mockResolvedValue(5);

        await expect(winnerService.assertRankingsNotYetGenerated({ force: false })).rejects.toMatchObject({ statusCode: 409 });
    });

    test('does not throw when winners exist but force is true', async () => {
        winnerRepository.count.mockResolvedValue(5);

        await expect(winnerService.assertRankingsNotYetGenerated({ force: true })).resolves.toBeUndefined();
    });

    test('defaults force to false when called with no arguments', async () => {
        winnerRepository.count.mockResolvedValue(1);

        await expect(winnerService.assertRankingsNotYetGenerated()).rejects.toMatchObject({ statusCode: 409 });
    });
});
