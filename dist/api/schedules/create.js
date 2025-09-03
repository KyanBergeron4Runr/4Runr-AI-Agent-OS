"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = route;
const client_1 = require("@prisma/client");
const schedules_1 = require("../../services/schedules");
const prisma = new client_1.PrismaClient();
async function route(app) {
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
        const { id } = req.params;
        const { cronExpr, enabled } = req.body;
        const agent = await prisma.runtimeAgent.findUnique({ where: { id } });
        if (!agent)
            return reply.code(404).send({ error: "agent_not_found" });
        const schedule = await (0, schedules_1.createSchedule)(id, cronExpr, enabled !== false);
        return { schedule };
    });
}
//# sourceMappingURL=create.js.map