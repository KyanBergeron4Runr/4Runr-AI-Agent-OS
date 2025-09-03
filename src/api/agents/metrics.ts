import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function route(app: FastifyInstance) {
  app.get("/api/agents/:id/metrics", async (req, reply) => {
    const { id } = req.params as any;
    const { limit = "20" } = req.query as any;
    
    const runs = await prisma.runtimeRun.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit)
    });

    // Calculate summary statistics
    const totalRuns = runs.length;
    const succeededRuns = runs.filter(r => r.status === "SUCCEEDED").length;
    const failedRuns = runs.filter(r => r.status === "FAILED").length;
    const runningRuns = runs.filter(r => r.status === "RUNNING").length;
    const totalRestarts = runs.reduce((sum, r) => sum + (r.restarts || 0), 0);
    const avgMemUsage = runs.filter(r => r.maxMemMb).reduce((sum, r) => sum + (r.maxMemMb || 0), 0) / runs.filter(r => r.maxMemMb).length || 0;

    return {
      summary: {
        totalRuns,
        succeededRuns,
        failedRuns,
        runningRuns,
        totalRestarts,
        successRate: totalRuns > 0 ? (succeededRuns / totalRuns * 100).toFixed(1) : "0.0",
        avgMemUsageMb: Math.round(avgMemUsage)
      },
      samples: runs.map(r => ({
        runId: r.id,
        status: r.status,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        exitCode: r.exitCode,
        maxMemMb: r.maxMemMb,
        cpuSeconds: r.cpuSeconds,
        restarts: r.restarts,
        lastSampleAt: r.lastSampleAt,
        durationMs: r.startedAt && r.endedAt ? r.endedAt.getTime() - r.startedAt.getTime() : null
      }))
    };
  });
}
