import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// In-memory cache for 10 seconds
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

function getCached(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCached(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

export default async function agentSummaryRoute(app: FastifyInstance) {
  app.get("/api/agents/:id/summary", async (req, reply) => {
    const { id } = req.params as { id: string };
    
    // Check cache first
    const cacheKey = `agent_summary_${id}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return reply.send(cached);
    }

    try {
      // Get agent
      const agent = await prisma.runtimeAgent.findUnique({
        where: { id },
        include: {
          runs: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      if (!agent) {
        return reply.code(404).send({ error: "Agent not found" });
      }

      // Get last 3 runs for health calculation
      const lastRuns = agent.runs.slice(0, 3);
      
      // Calculate health status
      let health: "HEALTHY" | "FLAKY" | "FAILING" = "FLAKY";
      
      if (lastRuns.length >= 3) {
        const allSucceeded = lastRuns.every(run => run.status === "SUCCEEDED");
        const allFailed = lastRuns.every(run => run.status === "FAILED");
        
        if (allSucceeded) {
          health = "HEALTHY";
        } else if (allFailed) {
          health = "FAILING";
        }
      } else if (lastRuns.length === 2) {
        const failedCount = lastRuns.filter(run => run.status === "FAILED").length;
        if (failedCount === 2) {
          health = "FAILING";
        }
      }

      // Get stats for last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const recentRuns = await prisma.runtimeRun.findMany({
        where: {
          agentId: id,
          createdAt: { gte: twentyFourHoursAgo }
        }
      });

      const runsStarted = recentRuns.length;
      const restarts = recentRuns.reduce((sum, run) => sum + run.restarts, 0);
      const schedulesTriggered = recentRuns.filter(run => run.triggeredBy === "SCHEDULE").length;
      
      // Calculate average peak memory
      const runsWithMemory = recentRuns.filter(run => run.maxMemMb !== null);
      const avgPeakMemMb = runsWithMemory.length > 0 
        ? runsWithMemory.reduce((sum, run) => sum + (run.maxMemMb || 0), 0) / runsWithMemory.length
        : 0;

      const response = {
        agentId: id,
        health,
        lastRuns: lastRuns.map(run => ({
          id: run.id,
          status: run.status,
          maxMemMb: run.maxMemMb,
          startedAt: run.startedAt,
          endedAt: run.endedAt
        })),
        stats: {
          runsStarted,
          restarts,
          avgPeakMemMb: Math.round(avgPeakMemMb * 10) / 10,
          schedulesTriggered
        }
      };

      // Cache the response
      setCached(cacheKey, response);
      
      return reply.send(response);
    } catch (error) {
      console.error("Error getting agent summary:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
