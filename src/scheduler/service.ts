import { PrismaClient } from "@prisma/client";
import { addOrUpdateCronJob, removeCronJob, schedulerQueue } from "./queue";
import { schedulerWorker, schedulerEvents } from "./worker";

const prisma = new PrismaClient();

export async function startSchedulerService() {
  // Check if Redis is available
  if (!schedulerQueue) {
    console.log("[scheduler] service disabled - Redis not available");
    return;
  }

  // Initialize worker and events
  try {
    // Sync all enabled schedules on boot
    const schedules = await prisma.runtimeSchedule.findMany({
      where: { enabled: true },
      select: { id: true, agentId: true, cronExpr: true }
    });

    for (const s of schedules) {
      await addOrUpdateCronJob({ scheduleId: s.id, agentId: s.agentId, cronExpr: s.cronExpr });
    }

    // Optional: log worker errors
    if (schedulerWorker) {
      schedulerWorker.on("failed", (job, err) => {
        console.error("[scheduler] job failed", job?.id, err?.message);
      });
      schedulerWorker.on("error", (err) => {
        console.error("[scheduler] worker error", err?.message);
      });
    }
    
    if (schedulerEvents) {
      schedulerEvents.on("error", (err) => {
        console.error("[scheduler] events error", err?.message);
      });
    }

    console.log("[scheduler] service started and schedules synced");
  } catch (error) {
    console.error("[scheduler] failed to start service:", error);
    console.log("[scheduler] service disabled due to errors");
  }
}
