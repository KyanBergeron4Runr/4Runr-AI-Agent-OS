-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_runtime_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "exitCode" INTEGER,
    "reason" TEXT,
    "cpuSeconds" REAL,
    "maxMemMb" INTEGER,
    "restarts" INTEGER NOT NULL DEFAULT 0,
    "lastSampleAt" DATETIME,
    "triggeredBy" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "runtime_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "runtime_agents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_runtime_runs" ("agentId", "cpuSeconds", "createdAt", "endedAt", "exitCode", "id", "lastSampleAt", "maxMemMb", "reason", "restarts", "startedAt", "status") SELECT "agentId", "cpuSeconds", "createdAt", "endedAt", "exitCode", "id", "lastSampleAt", "maxMemMb", "reason", "restarts", "startedAt", "status" FROM "runtime_runs";
DROP TABLE "runtime_runs";
ALTER TABLE "new_runtime_runs" RENAME TO "runtime_runs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
