import { Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { launchRun } from "../runtime/runner"; // from TASK-001
import path from "path";

const prisma = new PrismaClient();

// Create Redis connection with error handling
let connection: IORedis | null = null;
let worker: Worker | null = null;
let events: QueueEvents | null = null;

// Only try to connect if REDIS_URL is explicitly set and not empty
if (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') {
  try {
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    connection.on('error', (error) => {
      console.warn('⚠️ Redis connection error (worker will be disabled):', error.message);
      connection = null;
      worker = null;
      events = null;
    });

    connection.on('connect', () => {
      console.log('✅ Redis connected for worker');
    });

    // Only create worker and events if connection is successful
    if (connection) {
      const SCHEDULER_QUEUE_NAME = process.env.SCHEDULER_QUEUE_NAME || "4runr-scheduler";
      const CONCURRENCY = Number(process.env.SCHEDULER_CONCURRENCY || "5");

      // Choice: handle diverse agent source; for MVP, map to sample dirs by language
      function resolveHostMount(agent: any) {
        if (agent.language === "NODE") return path.resolve("agents-samples/node-hello");
        return path.resolve("agents-samples/python-hello");
      }

      worker = new Worker(SCHEDULER_QUEUE_NAME, async (job) => {
        console.log(`[scheduler] processing job ${job.id}`);
        const { scheduleId, agentId } = job.data as { scheduleId: string; agentId: string };

        const schedule = await prisma.runtimeSchedule.findUnique({ where: { id: scheduleId } });
        if (!schedule || !schedule.enabled) {
          return; // schedule disabled or deleted
        }

        const agent = await prisma.runtimeAgent.findUnique({ where: { id: agentId } });
        if (!agent) return;

        // Update schedule lastRunAt
        await prisma.runtimeSchedule.update({
          where: { id: scheduleId },
          data: { lastRunAt: new Date() }
        });

        // Launch a run
        const hostMountPath = resolveHostMount(agent);

        await launchRun({
          agentId: agent.id,
          language: agent.language as any,
          entrypoint: agent.entrypoint,
          hostMountPath,
          cpus: agent.limitsCpu ?? undefined,
          memMb: agent.limitsMemMb ?? undefined
        });

      }, { connection, concurrency: CONCURRENCY });

      events = new QueueEvents(SCHEDULER_QUEUE_NAME, { connection });
    }
  } catch (error) {
    console.warn('⚠️ Failed to create Redis connection (worker will be disabled):', error);
    connection = null;
    worker = null;
    events = null;
  }
} else {
  console.log('ℹ️ Redis URL not configured - worker disabled');
}

export const SCHEDULER_QUEUE_NAME = process.env.SCHEDULER_QUEUE_NAME || "4runr-scheduler";

// Export worker and events (null if Redis unavailable)
export const schedulerWorker = worker;
export const schedulerEvents = events;

export async function processScheduledJob(job: any) {
  const { agentId } = job.data;
  
  try {
    // Get agent details
    const agent = await prisma.runtimeAgent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      console.error(`[scheduler] Agent ${agentId} not found`);
      return;
    }

    // Resolve host mount path
    let hostMountPath = agent.sourceUri!;
    if (!hostMountPath || hostMountPath.includes("node-hello")) {
      if (agent.name.includes("fail")) {
        hostMountPath = require("path").resolve("agents-samples/node-fail");
      }
    }

    // Launch run with SCHEDULE trigger
    const { runId } = await launchRun({
      agentId: agent.id,
      language: agent.language as any,
      entrypoint: agent.entrypoint,
      hostMountPath,
      cpus: agent.limitsCpu ?? undefined,
      memMb: agent.limitsMemMb ?? undefined,
      env: agent.env as Record<string, any>
    });

    // Update the run to mark it as triggered by schedule
    await prisma.runtimeRun.update({
      where: { id: runId },
      data: { triggeredBy: "SCHEDULE" }
    });

    console.log(`[scheduler] Started scheduled run ${runId} for agent ${agentId}`);
  } catch (error) {
    console.error(`[scheduler] Failed to start scheduled run for agent ${agentId}:`, error);
    throw error;
  }
}
