import { Queue, JobsOptions } from "bullmq";
import IORedis from "ioredis";

// Create Redis connection with error handling
let connection: IORedis | null = null;
let queue: Queue | null = null;

// Only try to connect if REDIS_URL is explicitly set and not empty
if (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') {
  try {
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    connection.on('error', (error) => {
      console.warn('⚠️ Redis connection error (scheduler will be disabled):', error.message);
      connection = null;
      queue = null;
    });

    connection.on('connect', () => {
      console.log('✅ Redis connected for scheduler');
    });

    // Only create queue if connection is successful
    if (connection) {
      const SCHEDULER_QUEUE_NAME = process.env.SCHEDULER_QUEUE_NAME || "4runr-scheduler";
      queue = new Queue(SCHEDULER_QUEUE_NAME, { connection });
    }
  } catch (error) {
    console.warn('⚠️ Failed to create Redis connection (scheduler will be disabled):', error);
    connection = null;
    queue = null;
  }
} else {
  console.log('ℹ️ Redis URL not configured - scheduler disabled');
}

export const SCHEDULER_QUEUE_NAME = process.env.SCHEDULER_QUEUE_NAME || "4runr-scheduler";

// Export the queue (null if Redis unavailable)
export const schedulerQueue = queue;

export type ScheduleJobData = {
  scheduleId: string;
  agentId: string;
};

export async function addOrUpdateCronJob(params: {
  scheduleId: string;
  agentId: string;
  cronExpr: string;       // standard cron
  tz?: string;            // DEFAULT_TIMEZONE fallback
}) {
  if (!schedulerQueue) {
    console.warn('⚠️ Scheduler disabled - Redis not available');
    return;
  }

  const tz = params.tz || process.env.DEFAULT_TIMEZONE || "UTC";
  const jobName = `schedule:${params.scheduleId}`;

  const opts: JobsOptions = {
    repeat: { pattern: params.cronExpr, tz },
    removeOnComplete: 1000,
    removeOnFail: 1000,
    jobId: jobName, // ensures one job per schedule (update replaces)
  };

  await schedulerQueue.add(jobName, {
    scheduleId: params.scheduleId,
    agentId: params.agentId,
  } as ScheduleJobData, opts);
}

export async function removeCronJob(scheduleId: string) {
  if (!schedulerQueue) {
    console.warn('⚠️ Scheduler disabled - Redis not available');
    return;
  }

  const jobName = `schedule:${scheduleId}`;
  // Remove repeatable by key
  const repeatables = await schedulerQueue.getRepeatableJobs();
  const match = repeatables.find(r => r.id === jobName);
  if (match) {
    await schedulerQueue.removeRepeatableByKey(match.key);
  }
}
