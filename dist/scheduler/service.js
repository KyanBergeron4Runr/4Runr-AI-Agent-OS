"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSchedulerService = startSchedulerService;
const client_1 = require("@prisma/client");
const queue_1 = require("./queue");
const worker_1 = require("./worker");
const prisma = new client_1.PrismaClient();
async function startSchedulerService() {
    // Initialize worker and events
    // Sync all enabled schedules on boot
    const schedules = await prisma.runtimeSchedule.findMany({
        where: { enabled: true },
        select: { id: true, agentId: true, cronExpr: true }
    });
    for (const s of schedules) {
        await (0, queue_1.addOrUpdateCronJob)({ scheduleId: s.id, agentId: s.agentId, cronExpr: s.cronExpr });
    }
    // Optional: log worker errors
    worker_1.schedulerWorker.on("failed", (job, err) => {
        console.error("[scheduler] job failed", job?.id, err?.message);
    });
    worker_1.schedulerWorker.on("error", (err) => {
        console.error("[scheduler] worker error", err?.message);
    });
    worker_1.schedulerEvents.on("error", (err) => {
        console.error("[scheduler] events error", err?.message);
    });
    console.log("[scheduler] service started and schedules synced");
}
//# sourceMappingURL=service.js.map