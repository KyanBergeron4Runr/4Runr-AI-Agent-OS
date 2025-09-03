"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = kpisRoute;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// In-memory cache for 5 seconds
let cachedKpis = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds
async function kpisRoute(app) {
    app.get("/api/summary/kpis", async (req, reply) => {
        // Check cache first
        if (cachedKpis && Date.now() - cacheTimestamp < CACHE_TTL) {
            return reply.send(cachedKpis);
        }
        try {
            // Get stats for last 24 hours
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentRuns = await prisma.runtimeRun.findMany({
                where: {
                    createdAt: { gte: twentyFourHoursAgo }
                }
            });
            const runsStarted = recentRuns.length;
            const restarts = recentRuns.reduce((sum, run) => sum + run.restarts, 0);
            const schedulesTriggered = recentRuns.filter(run => run.triggeredBy === "SCHEDULE").length;
            // Calculate peak memory across all runs
            const runsWithMemory = recentRuns.filter(run => run.maxMemMb !== null);
            const peakMemMb = runsWithMemory.length > 0
                ? Math.max(...runsWithMemory.map(run => run.maxMemMb || 0))
                : 0;
            const response = {
                runsStarted,
                restarts,
                peakMemMb,
                schedulesTriggered
            };
            // Cache the response
            cachedKpis = response;
            cacheTimestamp = Date.now();
            return reply.send(response);
        }
        catch (error) {
            console.error("Error getting KPIs:", error);
            return reply.code(500).send({ error: "Internal server error" });
        }
    });
}
//# sourceMappingURL=kpis.js.map