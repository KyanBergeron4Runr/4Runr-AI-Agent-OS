"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = route;
const schedules_1 = require("../../services/schedules");
async function route(app) {
    app.delete("/api/schedules/:id", {}, async (req, reply) => {
        const { id } = req.params;
        await (0, schedules_1.deleteSchedule)(id);
        return { ok: true };
    });
}
//# sourceMappingURL=delete.js.map