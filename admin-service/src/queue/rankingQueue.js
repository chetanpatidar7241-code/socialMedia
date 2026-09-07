const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const config = require('../config/env');

const QUEUE_NAME = 'ranking';

// This connection backs producer-side calls (Queue.add / Queue.getJob) made from
// inside an HTTP request handler — those must fail within a bounded time if Redis is
// unreachable, not hang the request indefinitely. `maxRetriesPerRequest: null` is
// required by BullMQ itself (it issues blocking commands internally); `retryStrategy`
// caps *reconnect* attempts so a downed Redis eventually surfaces as a rejected
// promise instead of ioredis's default "queue commands and wait forever" behavior.
// The worker process (src/workers/rankingWorker.js) intentionally uses a separate,
// infinitely-retrying connection instead — it has no HTTP request waiting on it.
const connection = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 3000))
});

const rankingQueue = new Queue(QUEUE_NAME, { connection });

// Job history doesn't need to live in Redis forever — completed jobs are kept for an
// hour (enough to poll the result), failed ones for a day (enough to notice/debug).
const JOB_OPTIONS = {
    removeOnComplete: { age: 60 * 60 },
    removeOnFail: { age: 24 * 60 * 60 }
};

// POST /ranking/generate — the pre-enqueue 409 guard (assertRankingsNotYetGenerated)
// runs in the controller before this is ever called; this just hands the actual
// generateInitialRankings work to the worker.
async function enqueueGenerate({ force }) {
    const job = await rankingQueue.add('generate', { force }, JOB_OPTIONS);
    return job.id;
}

// POST /winners/:id/kyc (FAILED path only) — the cascade search + Prisma transaction
// runs in the worker via winnerService.markKycFailedWithCascade, unchanged.
async function enqueueKycFailedCascade({ winnerId }) {
    const job = await rankingQueue.add('kycFailedCascade', { winnerId }, JOB_OPTIONS);
    return job.id;
}

// Backs GET /api/ranking/jobs/:jobId. Returns null if the job id is unknown (either
// never existed or already aged out per removeOnComplete/removeOnFail above).
async function getJobStatus(jobId) {
    const job = await rankingQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    if (state === 'completed') {
        return { jobId: job.id, status: 'completed', result: job.returnvalue };
    }
    if (state === 'failed') {
        return { jobId: job.id, status: 'failed', error: job.failedReason };
    }
    return { jobId: job.id, status: state };
}

module.exports = { QUEUE_NAME, enqueueGenerate, enqueueKycFailedCascade, getJobStatus };
