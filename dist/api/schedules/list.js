"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = route;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function route(app) {
    app.get("/api/agents/:id/schedules", {}, async (req, reply) => {
        const { id } = req.params;
        const rows = await prisma.runtimeSchedule.findMany({ where: { agentId: id } });
        return { schedules: rows };
    });
}
//# sourceMappingURL=list.js.map