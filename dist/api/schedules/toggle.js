"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = route;
const schedules_1 = require("../../services/schedules");
async function route(app) {
    app.post("/api/schedules/:id/toggle", {
        schema: { body: { type: "object", required: ["enabled"], properties: { enabled: { type: "boolean" } } } }
    }, async (req, reply) => {
        const { id } = req.params;
        const { enabled } = req.body;
        const s = await (0, schedules_1.toggleSchedule)(id, enabled);
        return { schedule: s };
    });
}
//# sourceMappingURL=toggle.js.map