import { EventEmitter } from 'events';

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  heapLimit: number;
  rss: number;
  external: number;
  timestamp: number;
}

export class MemoryMonitor extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private warningThreshold = 0.8;  // 80% of heap limit
  private criticalThreshold = 0.9; // 90% of heap limit
  private lastWarning = 0;
  private warningCooldown = 30000; // 30 seconds between warnings

  constructor(
    private monitoringInterval = 5000, // 5 seconds
    private logStats = false
  ) {
    super();
  }

  start(): void {
    if (this.intervalId) {
      return; // Already running
    }

    this.intervalId = setInterval(() => {
      const stats = this.getMemoryStats();
      this.checkThresholds(stats);
      
      if (this.logStats) {
        console.log(`[Memory] Heap: ${Math.round(stats.heapUsed / 1024 / 1024)}MB / ${Math.round(stats.heapTotal / 1024 / 1024)}MB (${Math.round((stats.heapUsed / stats.heapLimit) * 100)}%)`);
      }
      
      this.emit('stats', stats);
    }, this.monitoringInterval);

    console.log('🧠 Memory monitor started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🧠 Memory monitor stopped');
    }
  }

  getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    const heapLimit = this.getHeapLimit();
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapLimit,
      rss: memUsage.rss,
      external: memUsage.external,
      timestamp: Date.now()
    };
  }

  private getHeapLimit(): number {
    // Try to get the actual heap limit from V8
    try {
      const v8 = require('v8');
      const heapStats = v8.getHeapStatistics();
      return heapStats.heap_size_limit;
    } catch {
      // Fallback to estimated limit (1GB = 1024MB as set in Dockerfile)
      return 1024 * 1024 * 1024;
    }
  }

  private checkThresholds(stats: MemoryStats): void {
    const usagePercentage = stats.heapUsed / stats.heapLimit;
    const now = Date.now();

    if (usagePercentage >= this.criticalThreshold) {
      if (now - this.lastWarning > this.warningCooldown) {
        this.emit('critical', stats, usagePercentage);
        this.lastWarning = now;
        console.error(`🚨 CRITICAL: Memory usage at ${Math.round(usagePercentage * 100)}% (${Math.round(stats.heapUsed / 1024 / 1024)}MB / ${Math.round(stats.heapLimit / 1024 / 1024)}MB)`);
      }
    } else if (usagePercentage >= this.warningThreshold) {
      if (now - this.lastWarning > this.warningCooldown) {
        this.emit('warning', stats, usagePercentage);
        this.lastWarning = now;
        console.warn(`⚠️  WARNING: Memory usage at ${Math.round(usagePercentage * 100)}% (${Math.round(stats.heapUsed / 1024 / 1024)}MB / ${Math.round(stats.heapLimit / 1024 / 1024)}MB)`);
      }
    }
  }

  // Force garbage collection if available (needs --expose-gc flag)
  forceGC(): boolean {
    try {
      if (global.gc) {
        global.gc();
        console.log('🗑️  Forced garbage collection');
        return true;
      }
    } catch (error) {
      console.warn('Failed to force GC:', error);
    }
    return false;
  }
}

export const memoryMonitor = new MemoryMonitor();
