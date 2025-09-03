"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulerEvents = exports.schedulerWorker = void 0;
exports.processScheduledJob = processScheduledJob;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const client_1 = require("@prisma/client");
const runner_1 = require("../runtime/runner"); // from TASK-001
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
const connection = new ioredis_1.default(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
});
const QUEUE_NAME = process.env.SCHEDULER_QUEUE_NAME || "4runr-scheduler";
const CONCURRENCY = Number(process.env.SCHEDULER_CONCURRENCY || "5");
// Choice: handle diverse agent source; for MVP, map to sample dirs by language
function resolveHostMount(agent) {
    if (agent.language === "NODE")
        return path_1.default.resolve("agents-samples/node-hello");
    return path_1.default.resolve("agents-samples/python-hello");
}
exports.schedulerWorker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
    const { scheduleId, agentId } = job.data;
    const schedule = await prisma.runtimeSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule || !schedule.enabled) {
        return; // schedule disabled or deleted
    }
    const agent = await prisma.runtimeAgent.findUnique({ where: { id: agentId } });
    if (!agent)
        return;
    // Update schedule lastRunAt
    await prisma.runtimeSchedule.update({
        where: { id: scheduleId },
        data: { lastRunAt: new Date() }
    });
    // Launch a run
    const hostMountPath = resolveHostMount(agent);
    await (0, runner_1.launchRun)({
        agentId: agent.id,
        language: agent.language,
        entrypoint: agent.entrypoint,
        hostMountPath,
        cpus: agent.limitsCpu ?? undefined,
        memMb: agent.limitsMemMb ?? undefined
    });
}, { connection, concurrency: CONCURRENCY });
exports.schedulerEvents = new bullmq_1.QueueEvents(QUEUE_NAME, { connection });
async function processScheduledJob(job) {
    const { agentId } = job.data;
    try {
        // Get agent details
        const agent = await prisma.runtimeAgent.findUnique({
            where: { id: agentId }
        });
        if (!agent) {
            console.error(`[scheduler] Agent ${agentId} not found`);
            return;
        }
        // Resolve host mount path
        let hostMountPath = agent.sourceUri;
        if (!hostMountPath || hostMountPath.includes("node-hello")) {
            if (agent.name.includes("fail")) {
                hostMountPath = require("path").resolve("agents-samples/node-fail");
            }
        }
        // Launch run with SCHEDULE trigger
        const { runId } = await (0, runner_1.launchRun)({
            agentId: agent.id,
            language: agent.language,
            entrypoint: agent.entrypoint,
            hostMountPath,
            cpus: agent.limitsCpu ?? undefined,
            memMb: agent.limitsMemMb ?? undefined,
            env: agent.env
        });
        // Update the run to mark it as triggered by schedule
        await prisma.runtimeRun.update({
            where: { id: runId },
            data: { triggeredBy: "SCHEDULE" }
        });
        console.log(`[scheduler] Started scheduled run ${runId} for agent ${agentId}`);
    }
    catch (error) {
        console.error(`[scheduler] Failed to start scheduled run for agent ${agentId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=worker.js.map