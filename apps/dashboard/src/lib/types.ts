// Agent types
export interface Agent {
  id: string;
  name: string;
  language: 'NODE' | 'PYTHON';
  entrypoint: string;
  status: 'READY' | 'RUNNING' | 'FAILED';
  limitsCpu?: number;
  limitsMemMb?: number;
  maxRestarts: number;
  restartBackoffMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentData {
  name: string;
  language: 'NODE' | 'PYTHON';
  entrypoint: string;
  limitsCpu?: number;
  limitsMemMb?: number;
  maxRestarts?: number;
  restartBackoffMs?: number;
}

// Schedule types
export interface Schedule {
  id: string;
  agentId: string;
  cronExpr: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

// Status and monitoring types
export interface AgentStatus {
  agent: {
    id: string;
    name: string;
    status: string;
    maxRestarts: number;
    restartBackoffMs: number;
    limitsCpu?: number;
    limitsMemMb?: number;
  };
  lastRun: {
    id: string;
    status: string;
    startedAt?: string;
    endedAt?: string;
    exitCode?: number;
    restarts: number;
    maxMemMb?: number;
    cpuSeconds?: number;
    lastSampleAt?: string;
  } | null;
  uptimeMs: number | null;
}

export interface RunSample {
  runId: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  exitCode?: number;
  maxMemMb?: number;
  cpuSeconds?: number;
  restarts: number;
  lastSampleAt?: string;
  durationMs?: number;
}

export interface AgentMetrics {
  summary: {
    totalRuns: number;
    succeededRuns: number;
    failedRuns: number;
    runningRuns: number;
    totalRestarts: number;
    successRate: string;
    avgMemUsageMb: number;
  };
  samples: RunSample[];
}

// Log streaming types
export interface LogEntry {
  log: string;
  timestamp: string;
}

export interface LogStreamEvent {
  runId: string;
  containerId: string;
}
