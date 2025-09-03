import { PrismaClient } from "@prisma/client";
import { addOrUpdateCronJob, removeCronJob } from "../scheduler/queue";

const prisma = new PrismaClient();

export async function createSchedule(agentId: string, cronExpr: string, enabled = true) {
  const schedule = await prisma.runtimeSchedule.create({
    data: { agentId, cronExpr, enabled }
  });
  if (enabled) {
    await addOrUpdateCronJob({ scheduleId: schedule.id, agentId, cronExpr });
  }
  return schedule;
}

export async function updateSchedule(id: string, fields: { cronExpr?: string; enabled?: boolean }) {
  const existing = await prisma.runtimeSchedule.findUnique({ where: { id } });
  if (!existing) throw new Error("not_found");

  const updated = await prisma.runtimeSchedule.update({
    where: { id },
    data: { cronExpr: fields.cronExpr ?? existing.cronExpr, enabled: fields.enabled ?? existing.enabled }
  });

  // re-sync queue
  await removeCronJob(id);
  if (updated.enabled) {
    await addOrUpdateCronJob({ scheduleId: id, agentId: updated.agentId, cronExpr: updated.cronExpr });
  }
  return updated;
}

export async function deleteSchedule(id: string) {
  await removeCronJob(id);
  await prisma.runtimeSchedule.delete({ where: { id } });
}

export async function toggleSchedule(id: string, enabled: boolean) {
  const s = await prisma.runtimeSchedule.update({ where: { id }, data: { enabled } });
  await removeCronJob(id);
  if (enabled) {
    await addOrUpdateCronJob({ scheduleId: id, agentId: s.agentId, cronExpr: s.cronExpr });
  }
  return s;
}
