import { FastifyInstance } from "fastify";
import { toggleSchedule } from "../../services/schedules";

export default async function route(app: FastifyInstance) {
  app.post("/api/schedules/:id/toggle", {
    schema: { body: { type: "object", required: ["enabled"], properties: { enabled: { type: "boolean" } } } }
  }, async (req, reply) => {
    const { id } = req.params as any;
    const { enabled } = req.body as any;
    const s = await toggleSchedule(id, enabled);
    return { schedule: s };
  });
}
