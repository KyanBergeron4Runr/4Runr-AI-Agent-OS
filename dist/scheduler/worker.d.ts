import { Worker, QueueEvents, Job } from "bullmq";
export declare const schedulerWorker: Worker<any, any, string>;
export declare const schedulerEvents: QueueEvents;
export declare function processScheduledJob(job: Job): Promise<void>;
//# sourceMappingURL=worker.d.ts.map