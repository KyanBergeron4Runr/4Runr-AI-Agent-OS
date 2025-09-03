"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSchedule = createSchedule;
exports.updateSchedule = updateSchedule;
exports.deleteSchedule = deleteSchedule;
exports.toggleSchedule = toggleSchedule;
const client_1 = require("@prisma/client");
const queue_1 = require("../scheduler/queue");
const prisma = new client_1.PrismaClient();
async function createSchedule(agentId, cronExpr, enabled = true) {
    const schedule = await prisma.runtimeSchedule.create({
        data: { agentId, cronExpr, enabled }
    });
    if (enabled) {
        await (0, queue_1.addOrUpdateCronJob)({ scheduleId: schedule.id, agentId, cronExpr });
    }
    return schedule;
}
async function updateSchedule(id, fields) {
    const existing = await prisma.runtimeSchedule.findUnique({ where: { id } });
    if (!existing)
        throw new Error("not_found");
    const updated = await prisma.runtimeSchedule.update({
        where: { id },
        data: { cronExpr: fields.cronExpr ?? existing.cronExpr, enabled: fields.enabled ?? existing.enabled }
    });
    // re-sync queue
    await (0, queue_1.removeCronJob)(id);
    if (updated.enabled) {
        await (0, queue_1.addOrUpdateCronJob)({ scheduleId: id, agentId: updated.agentId, cronExpr: updated.cronExpr });
    }
    return updated;
}
async function deleteSchedule(id) {
    await (0, queue_1.removeCronJob)(id);
    await prisma.runtimeSchedule.delete({ where: { id } });
}
async function toggleSchedule(id, enabled) {
    const s = await prisma.runtimeSchedule.update({ where: { id }, data: { enabled } });
    await (0, queue_1.removeCronJob)(id);
    if (enabled) {
        await (0, queue_1.addOrUpdateCronJob)({ scheduleId: id, agentId: s.agentId, cronExpr: s.cronExpr });
    }
    return s;
}
//# sourceMappingURL=schedules.js.map