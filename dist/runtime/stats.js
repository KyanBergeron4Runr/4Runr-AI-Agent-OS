"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStatsSampler = startStatsSampler;
exports.stopStatsSampler = stopStatsSampler;
const dockerode_1 = __importDefault(require("dockerode"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const docker = new dockerode_1.default();
const INTERVAL = Number(process.env.RUNTIME_STATS_INTERVAL_MS || 5000);
function startStatsSampler() {
    console.log(`[stats] Starting resource sampler with ${INTERVAL}ms interval`);
    setInterval(async () => {
        try {
            // Find RUNNING runs with containerId in reason
            const running = await prisma.runtimeRun.findMany({
                where: { status: "RUNNING" },
                select: { id: true, reason: true, maxMemMb: true }
            });
            for (const r of running) {
                if (!r.reason)
                    continue;
                const container = docker.getContainer(r.reason);
                try {
                    const stream = await container.stats({ stream: false });
                    // Parse CPU seconds (approx) and memory usage
                    // Docker stats returns per-interval metrics; we'll approximate:
                    const memBytes = stream?.memory_stats?.usage ?? 0;
                    const memMb = Math.round(memBytes / (1024 * 1024));
                    // cpu total usage in nanoseconds since start:
                    const cpuTotal = stream?.cpu_stats?.cpu_usage?.total_usage ?? 0;
                    // Convert to approximate seconds (very rough)
                    const cpuSeconds = cpuTotal / 1000000000;
                    // Update with peak memory and latest sample time
                    const currentMaxMem = r.maxMemMb ?? 0;
                    const newPeak = Math.max(currentMaxMem, memMb);
                    await prisma.runtimeRun.update({
                        where: { id: r.id },
                        data: {
                            maxMemMb: newPeak,
                            cpuSeconds: cpuSeconds,
                            lastSampleAt: new Date()
                        }
                    });
                    // Log significant memory usage
                    if (memMb > 50) {
                        console.log(`[stats] Run ${r.id}: ${memMb}MB memory, ${cpuSeconds.toFixed(2)}s CPU`);
                    }
                }
                catch (e) {
                    // container may have exited; ignore
                }
            }
        }
        catch (e) {
            console.error("[stats] Sampler error:", e);
            // swallow to keep sampler alive
        }
    }, INTERVAL);
}
function stopStatsSampler() {
    // For graceful shutdown if needed
    console.log("[stats] Stats sampler stopped");
}
//# sourceMappingURL=stats.js.map