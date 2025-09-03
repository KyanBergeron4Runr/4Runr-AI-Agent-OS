import { EventEmitter } from 'events';
export interface MemoryStats {
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    rss: number;
    external: number;
    timestamp: number;
}
export declare class MemoryMonitor extends EventEmitter {
    private monitoringInterval;
    private logStats;
    private intervalId;
    private warningThreshold;
    private criticalThreshold;
    private lastWarning;
    private warningCooldown;
    constructor(monitoringInterval?: number, // 5 seconds
    logStats?: boolean);
    start(): void;
    stop(): void;
    getMemoryStats(): MemoryStats;
    private getHeapLimit;
    private checkThresholds;
    forceGC(): boolean;
}
export declare const memoryMonitor: MemoryMonitor;
//# sourceMappingURL=memory-monitor.d.ts.map