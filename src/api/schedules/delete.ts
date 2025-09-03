import { FastifyInstance } from "fastify";
import { deleteSchedule } from "../../services/schedules";

export default async function route(app: FastifyInstance) {
  app.delete("/api/schedules/:id", {}, async (req, reply) => {
    const { id } = req.params as any;
    await deleteSchedule(id);
    return { ok: true };
  });
}
