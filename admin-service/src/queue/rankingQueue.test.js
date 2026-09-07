const mockAdd = jest.fn();
const mockGetJob = jest.fn();

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({})));
jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: mockAdd,
        getJob: mockGetJob
    }))
}));
jest.mock('../config/env', () => ({ redisUrl: 'redis://localhost:6379' }));

const rankingQueue = require('./rankingQueue');

afterEach(() => jest.clearAllMocks());

describe('enqueueGenerate', () => {
    test('adds a "generate" job carrying the force flag and returns its id', async () => {
        mockAdd.mockResolvedValue({ id: 'job-1' });

        const jobId = await rankingQueue.enqueueGenerate({ force: true });

        expect(jobId).toBe('job-1');
        expect(mockAdd).toHaveBeenCalledWith('generate', { force: true }, expect.any(Object));
    });
});

describe('enqueueKycFailedCascade', () => {
    test('adds a "kycFailedCascade" job carrying the winnerId and returns its id', async () => {
        mockAdd.mockResolvedValue({ id: 'job-2' });

        const jobId = await rankingQueue.enqueueKycFailedCascade({ winnerId: 42 });

        expect(jobId).toBe('job-2');
        expect(mockAdd).toHaveBeenCalledWith('kycFailedCascade', { winnerId: 42 }, expect.any(Object));
    });
});

describe('getJobStatus', () => {
    test('returns null when the job id is unknown', async () => {
        mockGetJob.mockResolvedValue(null);

        expect(await rankingQueue.getJobStatus('missing')).toBeNull();
    });

    test('returns status "completed" with the job\'s return value', async () => {
        mockGetJob.mockResolvedValue({
            id: 'job-1',
            getState: jest.fn().mockResolvedValue('completed'),
            returnvalue: [{ tier: 'GRAND_PRIZE' }]
        });

        const status = await rankingQueue.getJobStatus('job-1');

        expect(status).toEqual({ jobId: 'job-1', status: 'completed', result: [{ tier: 'GRAND_PRIZE' }] });
    });

    test('returns status "failed" with the job\'s failure reason', async () => {
        mockGetJob.mockResolvedValue({
            id: 'job-1',
            getState: jest.fn().mockResolvedValue('failed'),
            failedReason: 'Winner not found'
        });

        const status = await rankingQueue.getJobStatus('job-1');

        expect(status).toEqual({ jobId: 'job-1', status: 'failed', error: 'Winner not found' });
    });

    test('returns the raw state for a still-pending/active job', async () => {
        mockGetJob.mockResolvedValue({
            id: 'job-1',
            getState: jest.fn().mockResolvedValue('active')
        });

        const status = await rankingQueue.getJobStatus('job-1');

        expect(status).toEqual({ jobId: 'job-1', status: 'active' });
    });
});
