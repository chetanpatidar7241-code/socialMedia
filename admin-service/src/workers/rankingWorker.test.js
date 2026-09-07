jest.mock('../services/winnerService');
// The worker only actually connects/starts listening inside the
// `require.main === module` guard, which never fires when Jest requires this file —
// so the real ../queue/rankingQueue (and its real Redis connection) is never needed;
// stub it just to avoid loading ioredis/bullmq at all here.
jest.mock('../queue/rankingQueue', () => ({ connection: {}, QUEUE_NAME: 'ranking' }));

const winnerService = require('../services/winnerService');
const { processor, createRankingWorker } = require('./rankingWorker');

afterEach(() => jest.clearAllMocks());

describe('processor', () => {
    test('dispatches a "generate" job to generateInitialRankings with its force flag', async () => {
        winnerService.generateInitialRankings.mockResolvedValue([{ tier: 'GRAND_PRIZE' }]);

        const result = await processor({ name: 'generate', data: { force: true } });

        expect(winnerService.generateInitialRankings).toHaveBeenCalledWith({ force: true });
        expect(result).toEqual([{ tier: 'GRAND_PRIZE' }]);
    });

    test('dispatches a "kycFailedCascade" job to markKycFailedWithCascade with its winnerId', async () => {
        winnerService.markKycFailedWithCascade.mockResolvedValue({ removed: { id: 7 }, promoted: null });

        const result = await processor({ name: 'kycFailedCascade', data: { winnerId: 7 } });

        expect(winnerService.markKycFailedWithCascade).toHaveBeenCalledWith(7);
        expect(result).toEqual({ removed: { id: 7 }, promoted: null });
    });

    test('rejects an unknown job name instead of silently doing nothing', async () => {
        await expect(processor({ name: 'mystery-job', data: {} })).rejects.toThrow(/Unknown ranking job name/);
    });
});

test('createRankingWorker exists for the standalone worker process to call (not exercised here — needs a real Redis)', () => {
    expect(typeof createRankingWorker).toBe('function');
});
