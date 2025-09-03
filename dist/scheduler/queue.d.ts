import { Queue } from "bullmq";
export declare const SCHEDULER_QUEUE_NAME: string;
export declare const schedulerQueue: Queue<any, any, string, any, any, string>;
export type ScheduleJobData = {
    scheduleId: string;
    agentId: string;
};
export declare function addOrUpdateCronJob(params: {
    scheduleId: string;
    agentId: string;
    cronExpr: string;
    tz?: string;
}): Promise<void>;
export declare function removeCronJob(scheduleId: string): Promise<void>;
//# sourceMappingURL=queue.d.ts.map