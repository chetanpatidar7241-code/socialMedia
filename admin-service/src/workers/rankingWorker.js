// Separate process: `npm run worker` (see package.json), NOT started by the main
// Express server (index.js). Run this alongside the API process — POST /ranking/generate
// and the KYC-FAILED path only enqueue a job; nothing executes until this process
// picks it up.
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { QUEUE_NAME } = require('../queue/rankingQueue');
const config = require('../config/env');
const winnerService = require('../services/winnerService');

// Dispatches to the exact same winnerService functions the request handlers used to
// call inline — MAX_CASCADE_RETRIES / unique-constraint-retry logic inside
// markKycFailedWithCascade is untouched; only the caller changed (worker job instead
// of an Express request handler).
async function processor(job) {
    if (job.name === 'generate') {
        return winnerService.generateInitialRankings({ force: job.data.force });
    }
    if (job.name === 'kycFailedCascade') {
        return winnerService.markKycFailedWithCascade(job.data.winnerId);
    }
    throw new Error(`Unknown ranking job name: ${job.name}`);
}

// Deliberately built inside this function (not at module load) so requiring this
// file — e.g. from a test importing `processor` — never opens a real Redis
// connection. This is a long-running background process, unlike the queue producer's
// connection in rankingQueue.js, so it retries Redis forever instead of giving up —
// there's no HTTP request waiting on it to fail fast.
function createRankingWorker() {
    const workerConnection = new IORedis(config.redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => Math.min(times * 1000, 10000)
    });

    const worker = new Worker(QUEUE_NAME, processor, { connection: workerConnection });

    worker.on('completed', (job) => {
        console.log(`[ranking-worker] job ${job.id} (${job.name}) completed`);
    });
    worker.on('failed', (job, err) => {
        console.error(`[ranking-worker] job ${job?.id} (${job?.name ?? 'unknown'}) failed:`, err.message);
    });

    return worker;
}

if (require.main === module) {
    createRankingWorker();
    console.log('[ranking-worker] listening for ranking jobs...');
}

module.exports = { processor, createRankingWorker };
