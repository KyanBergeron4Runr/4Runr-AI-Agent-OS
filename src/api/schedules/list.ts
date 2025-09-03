import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function route(app: FastifyInstance) {
  app.get("/api/agents/:id/schedules", {}, async (req, reply) => {
    const { id } = req.params as any;
    const rows = await prisma.runtimeSchedule.findMany({ where: { agentId: id } });
    return { schedules: rows };
  });
}
