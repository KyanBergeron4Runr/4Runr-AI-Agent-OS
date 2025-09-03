"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulerQueue = exports.SCHEDULER_QUEUE_NAME = void 0;
exports.addOrUpdateCronJob = addOrUpdateCronJob;
exports.removeCronJob = removeCronJob;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const connection = new ioredis_1.default(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
});
exports.SCHEDULER_QUEUE_NAME = process.env.SCHEDULER_QUEUE_NAME || "4runr-scheduler";
exports.schedulerQueue = new bullmq_1.Queue(exports.SCHEDULER_QUEUE_NAME, { connection });
async function addOrUpdateCronJob(params) {
    const tz = params.tz || process.env.DEFAULT_TIMEZONE || "UTC";
    const jobName = `schedule:${params.scheduleId}`;
    const opts = {
        repeat: { pattern: params.cronExpr, tz },
        removeOnComplete: 1000,
        removeOnFail: 1000,
        jobId: jobName, // ensures one job per schedule (update replaces)
    };
    await exports.schedulerQueue.add(jobName, {
        scheduleId: params.scheduleId,
        agentId: params.agentId,
    }, opts);
}
async function removeCronJob(scheduleId) {
    const jobName = `schedule:${scheduleId}`;
    // Remove repeatable by key
    const repeatables = await exports.schedulerQueue.getRepeatableJobs();
    const match = repeatables.find(r => r.id === jobName);
    if (match) {
        await exports.schedulerQueue.removeRepeatableByKey(match.key);
    }
}
//# sourceMappingURL=queue.js.map