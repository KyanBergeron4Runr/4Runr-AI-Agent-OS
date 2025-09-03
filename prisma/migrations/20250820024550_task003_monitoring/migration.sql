/*
  Warnings:

  - You are about to drop the column `logsPtr` on the `runtime_runs` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_runtime_agents" (
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
    "maxRestarts" INTEGER NOT NULL DEFAULT 2,
    "restartBackoffMs" INTEGER NOT NULL DEFAULT 5000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_runtime_agents" ("createdAt", "entrypoint", "env", "id", "language", "limitsCpu", "limitsMemMb", "name", "networkMode", "sourceType", "sourceUri", "status", "updatedAt") SELECT "createdAt", "entrypoint", "env", "id", "language", "limitsCpu", "limitsMemMb", "name", "networkMode", "sourceType", "sourceUri", "status", "updatedAt" FROM "runtime_agents";
DROP TABLE "runtime_agents";
ALTER TABLE "new_runtime_agents" RENAME TO "runtime_agents";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "runtime_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "runtime_agents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_runtime_runs" ("agentId", "cpuSeconds", "createdAt", "endedAt", "exitCode", "id", "maxMemMb", "reason", "startedAt", "status") SELECT "agentId", "cpuSeconds", "createdAt", "endedAt", "exitCode", "id", "maxMemMb", "reason", "startedAt", "status" FROM "runtime_runs";
DROP TABLE "runtime_runs";
ALTER TABLE "new_runtime_runs" RENAME TO "runtime_runs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
