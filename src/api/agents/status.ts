import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function route(app: FastifyInstance) {
  app.get("/api/agents/:id/status", async (req, reply) => {
    const { id } = req.params as any;
    const agent = await prisma.runtimeAgent.findUnique({ where: { id } });
    if (!agent) return reply.code(404).send({ error: "agent_not_found" });

    const lastRun = await prisma.runtimeRun.findFirst({
      where: { agentId: id },
      orderBy: { createdAt: "desc" }
    });

    let uptimeMs: number | null = null;
    if (lastRun?.startedAt && !lastRun?.endedAt) {
      uptimeMs = Date.now() - lastRun.startedAt.getTime();
    }

    return {
      agent: { 
        id: agent.id, 
        name: agent.name, 
        status: agent.status,
        maxRestarts: agent.maxRestarts,
        restartBackoffMs: agent.restartBackoffMs,
        limitsCpu: agent.limitsCpu,
        limitsMemMb: agent.limitsMemMb
      },
      lastRun: lastRun ? {
        id: lastRun.id,
        status: lastRun.status,
        startedAt: lastRun.startedAt,
        endedAt: lastRun.endedAt,
        exitCode: lastRun.exitCode,
        restarts: lastRun.restarts,
        maxMemMb: lastRun.maxMemMb,
        cpuSeconds: lastRun.cpuSeconds,
        lastSampleAt: lastRun.lastSampleAt
      } : null,
      uptimeMs
    };
  });
}
