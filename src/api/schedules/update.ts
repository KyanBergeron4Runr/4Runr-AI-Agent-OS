import { FastifyInstance } from "fastify";
import { updateSchedule } from "../../services/schedules";

export default async function route(app: FastifyInstance) {
  app.patch("/api/schedules/:id", {
    schema: {
      body: {
        type: "object",
        properties: {
          cronExpr: { type: "string" },
          enabled: { type: "boolean" }
        }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params as any;
    const { cronExpr, enabled } = req.body as any;
    const s = await updateSchedule(id, { cronExpr, enabled });
    return { schedule: s };
  });
}
