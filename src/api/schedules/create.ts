import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { createSchedule } from "../../services/schedules";
const prisma = new PrismaClient();

export default async function route(app: FastifyInstance) {
  app.post("/api/agents/:id/schedules", {
    schema: {
      body: {
        type: "object",
        required: ["cronExpr"],
        properties: {
          cronExpr: { type: "string" },
          enabled: { type: "boolean", default: true }
        }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params as any;
    const { cronExpr, enabled } = req.body as any;

    const agent = await prisma.runtimeAgent.findUnique({ where: { id } });
    if (!agent) return reply.code(404).send({ error: "agent_not_found" });

    const schedule = await createSchedule(id, cronExpr, enabled !== false);
    return { schedule };
  });
}
