"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = route;
const schedules_1 = require("../../services/schedules");
async function route(app) {
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
        const { id } = req.params;
        const { cronExpr, enabled } = req.body;
        const s = await (0, schedules_1.updateSchedule)(id, { cronExpr, enabled });
        return { schedule: s };
    });
}
//# sourceMappingURL=update.js.map