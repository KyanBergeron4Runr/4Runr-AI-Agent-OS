-- CreateTable
CREATE TABLE "runtime_agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'ZIP',
    "sourceUri" TEXT,
    "entrypoint" TEXT NOT NULL,
    "env" JSONB NOT NULL,
    "limitsCpu" REAL,
    "limitsMemMb" INTEGER,
    "networkMode" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "runtime_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "exitCode" INTEGER,
    "reason" TEXT,
    "cpuSeconds" REAL,
    "maxMemMb" INTEGER,
    "logsPtr" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "runtime_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "runtime_agents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "runtime_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "runtime_schedules_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "runtime_agents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
