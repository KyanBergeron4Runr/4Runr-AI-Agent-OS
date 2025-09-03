import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import path from "path";
import { launchRun } from "../../runtime/runner";
const prisma = new PrismaClient();

export default async function route(app: FastifyInstance) {
  app.post("/api/agents/:id/start", {}, async (req, reply) => {
    const { id } = req.params as any;
    const agent = await prisma.runtimeAgent.findUnique({ where: { id } });
    if (!agent) return reply.code(404).send({ error: "not_found" });

    // MVP: map sample code by language
    const hostMountPath = path.resolve(
      agent.language === "NODE" ? "agents-samples/node-hello" : "agents-samples/python-hello"
    );

    const { runId, containerId } = await launchRun({
      agentId: agent.id,
      language: agent.language as any,
      entrypoint: agent.entrypoint,
      hostMountPath,
      cpus: agent.limitsCpu ?? undefined,
      memMb: agent.limitsMemMb ?? undefined
    });

    return { runId, containerId };
  });
}
